// file ini untuk
// Create order
// Handle webhook
// Ambil data (users, payments, dll)
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb, orders } from "@payflow/db";
import { verifyXenditWebhook, generateIdempotencyKey } from "@payflow/utils";
import checkoutRoute from "./checkout";
import ordersRoute from "./orders";
import plansRoute from "./plans";
import subscriptionsRoute from "./subscriptions";
import customersRoute from "./customers";
import adminInvoicesRoute from "./adminInvoices";

type Bindings = {
  DATABASE_URL: string;
  XENDIT_SECRET_KEY: string;
  XENDIT_WEBHOOK_TOKEN: string;
  WEBHOOK_QUEUE: Queue;
  PAYMENT_QUEUE: Queue;
};

const app = new Hono<{ Bindings: Bindings }>();
// semua error yang tidak tertangani, akan masuk ke code ini
app.onError((err, c) => {
  console.error("[api-gateway] Unhandled error:", err);
  return c.json({ error: { code: "INTERNAL_ERROR", message: err.message } }, 500);
});

// mengizinkan frontend akses API tanpa code ini bakal diblock
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173"],
    // tambahkan lagi link url untuk vercel untuk mengindari error di vercel
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);


// Xendit Webhook
app.post("/webhook/xendit", async (c) => {
// ambil token dari header
  const token = c.req.header("x-callback-token") ?? ""; 
// code yg mengvalidasi apakah tokennya benar atau tidak 
  const isValid = verifyXenditWebhook(token, c.env.XENDIT_WEBHOOK_TOKEN);

  if (!isValid) {
    return c.json({ error: "Unauthorized" }, 401);
  }
// kalau benar dia akan diarankan ke queue
  const body = await c.req.json();
  await c.env.WEBHOOK_QUEUE.send(body);

  return c.json({ ok: true });
});

// Create Order
app.post("/api/orders", async (c) => {
  try {
    const { userId, planId, amount, currency, description } = await c.req.json<{
      userId: string;
      planId: string;
      amount: number;
      currency?: string;
      description?: string;
    }>();

    if (!userId || !planId || !amount) {
      return c.json({ error: { code: "INVALID_INPUT", message: "userId, planId, and amount are required" } }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);
    // mencegah duplikasi order jika user klik 2 kali 
    const idempotencyKey = generateIdempotencyKey("order");

    // Buat record order baru di DB (status awal: pending)
    // Catatan: amount disimpan sebagai string karena tipe kolom di DB adalah numeric.
    const [order] = await db.insert(orders).values({
      userId,
      idempotencyKey,
      amount: String(amount),
      currency: currency ?? "IDR",
      status: "pending",
      description,
    }).returning({ id: orders.id });

    // Enqueue job ke Cloudflare Queue "payment-jobs" supaya payment-worker memproses pembayaran (buat invoice Xendit, dll)
    await c.env.PAYMENT_QUEUE.send({ type: "process-payment", orderId: order.id });

    // Balikkan orderId ke client; proses pembayaran lanjut di background lewat queue
    return c.json({ data: { orderId: order.id } }, 201);
  } catch (err) {
    // Kalau ada error (JSON parsing / DB / queue), kembalikan 500 dengan pesan error
    console.error("[api-gateway] POST /api/orders error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

// Health check untuk memastikan worker/api-gateway hidup
app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

// List users (contoh endpoint untuk debugging / admin sederhana)
app.get("/api/users", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const users = await db.query.users.findMany();
  return c.json(users);
});

// List subscriptions
app.get("/api/subscriptions", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const subscriptions = await db.query.subscriptions.findMany();
  return c.json(subscriptions);
});

// List payments/orders (di schema, payments disimpan sebagai orders)
app.get("/api/payments", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const payments = await db.query.orders.findMany();
  return c.json(payments);
});

// Mount route untuk pembayaran one-time (contoh: POST /api/checkout)
app.route("/api", checkoutRoute);
// Mount route untuk baca detail order (contoh: GET /api/orders/:id)
app.route("/api", ordersRoute);

// Mount route untuk manajemen plan (contoh: list/CRUD plan)
app.route("/api", plansRoute);
// Mount route untuk flow subscription (create/upgrade/cancel, dll)
app.route("/api", subscriptionsRoute);
// Mount route untuk manajemen pelanggan (admin)
app.route("/api", customersRoute);
// Mount route untuk pembuatan invoice oleh admin
app.route("/api", adminInvoicesRoute);

// Export Hono app (entry point Worker) sesuai `main = "src/index.ts"` di wrangler.toml
export default app;
