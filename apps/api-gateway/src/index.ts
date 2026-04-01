// file ini untuk
// Create order
// Handle webhook
// Ambil data (users, payments, dll)
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb, orders } from "@payflow/db";
import { verifyXenditWebhook, generateIdempotencyKey } from "@payflow/utils";

type Bindings = {
  DATABASE_URL: string;
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

    const [order] = await db.insert(orders).values({
      userId,
      idempotencyKey,
      amount: String(amount),
      currency: currency ?? "IDR",
      status: "pending",
      description,
    }).returning({ id: orders.id });

    await c.env.PAYMENT_QUEUE.send({ type: "process-payment", orderId: order.id });

    return c.json({ data: { orderId: order.id } }, 201);
  } catch (err) {
    console.error("[api-gateway] POST /api/orders error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

// Health check
app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

// Users
app.get("/api/users", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const users = await db.query.users.findMany();
  return c.json(users);
});

// Subscriptions
app.get("/api/subscriptions", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const subscriptions = await db.query.subscriptions.findMany();
  return c.json(subscriptions);
});

// Payments
app.get("/api/payments", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const payments = await db.query.orders.findMany();
  return c.json(payments);
});

export default app;
