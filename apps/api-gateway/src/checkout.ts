/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { createDb, orders, users } from "@payflow/db";
import { generateIdempotencyKey } from "@payflow/utils";
import { eq } from "drizzle-orm";

type Env = {
  Bindings: {
    // Connection string database (Neon/Postgres) yang dipakai Drizzle
    DATABASE_URL: string;
    // Cloudflare Queue untuk mengirim job pemrosesan pembayaran secara async
    PAYMENT_QUEUE: Queue;
  };
};

// Router / handler untuk Worker api-gateway (Hono)
const app = new Hono<Env>();

// Endpoint one-time checkout:
// 1) validasi input
// 2) cek user exist
// 3) create order (status: pending)
// 4) kirim job ke queue agar payment-worker memproses pembuatan invoice
app.post("/checkout", async (c) => {
  try {
    // Body request dari client (frontend / service lain)
    const body = await c.req.json<{
      userId: string;
      planId?: string;
      amount: number;
      currency?: string;
      description?: string;
    }>();

    // Validasi: userId wajib ada dan bertipe string
    if (!body.userId || typeof body.userId !== "string") {
      return c.json(
        { error: { code: "INVALID_INPUT", message: "userId is required" } },
        400
      );
    }
    // Validasi: amount wajib number dan > 0
    if (!body.amount || typeof body.amount !== "number" || body.amount <= 0) {
      return c.json(
        { error: { code: "INVALID_INPUT", message: "amount must be a positive number" } },
        400
      );
    }

    // Buat DB client untuk query/insert menggunakan DATABASE_URL (binding dari env)
    const db = createDb(c.env.DATABASE_URL);

    // Cek user exist biar tidak buat order untuk userId yang tidak valid
    const user = await db.query.users.findFirst({
      where: eq(users.id, body.userId),
    });
    if (!user) {
      return c.json(
        { error: { code: "USER_NOT_FOUND", message: "User not found" } },
        404
      );
    }

    // Idempotency key: disimpan di tabel orders dan dipakai oleh payment-worker sebagai external_id invoice.
    // Tujuan: mencegah duplikasi invoice/charge kalau ada retry atau user klik bayar berkali-kali.
    const idempotencyKey = generateIdempotencyKey("order");

    // Simpan order baru dengan status "pending"
    const [order] = await db
      .insert(orders)
      .values({
        userId: body.userId,
        idempotencyKey,
        amount: String(body.amount),
        currency: body.currency ?? "IDR",
        status: "pending",
        description: body.description,
      })
      .returning({ id: orders.id });

    // Kirim job ke queue supaya proses pembuatan invoice dilakukan async oleh payment-worker
    await c.env.PAYMENT_QUEUE.send({ type: "process-payment", orderId: order.id });

    // Response cepat ke client: order sudah dibuat, payment sedang diproses di background
    return c.json({ orderId: order.id, status: "pending" }, 201);
  } catch (err) {
    // Error handler (validasi/DB/JSON parsing) -> 500
    console.error("[checkout] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

// Export route untuk dipasang (mounted) di apps/api-gateway/src/index.ts lewat app.route("/api", checkoutRoute)
export default app;
