/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { createDb, getOrderById } from "@payflow/db";

type Env = {
  Bindings: {
    // Connection string database (Neon/Postgres)
    DATABASE_URL: string;
  };
};

// Route kecil untuk baca order (dipakai frontend PaymentStatusPage untuk polling status)
const app = new Hono<Env>();

// GET /api/orders/:id
// Read-only: hanya ambil data order untuk kebutuhan status halaman pembayaran.
// Status pembayaran tidak pernah diubah lewat endpoint ini (status berubah via webhook-worker).
app.get("/orders/:id", async (c) => {
  // Ambil orderId dari path param
  const id = c.req.param("id");

  // Validasi sederhana
  if (!id || id.trim() === "") {
    return c.json({ error: { code: "INVALID_INPUT", message: "orderId is required" } }, 400);
  }

  try {
    // Query DB
    const db = createDb(c.env.DATABASE_URL);
    const order = await getOrderById(db, id);

    if (!order) {
      return c.json({ error: { code: "NOT_FOUND", message: "Order not found" } }, 404);
    }

    // Return field yang dibutuhkan UI (paymentUrl bisa null sampai payment-worker selesai buat invoice)
    return c.json({
      id: order.id,
      status: order.status,
      amount: Number(order.amount),
      currency: order.currency,
      paymentUrl: order.paymentUrl ?? null,
      xenditInvoiceId: order.xenditInvoiceId ?? null,
      expiresAt: order.expiresAt ?? null,
      paidAt: order.paidAt ?? null,
      createdAt: order.createdAt,
    });
  } catch (err) {
    // Error DB/unknown
    console.error("[orders] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

// Export route untuk dipasang di `apps/api-gateway/src/index.ts` lewat `app.route("/api", ordersRoute)`
export default app;
