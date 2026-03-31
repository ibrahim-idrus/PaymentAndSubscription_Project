import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "@payflow/db";

type Bindings = {
  DATABASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

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
  const payments = await db.query.payments.findMany();
  return c.json(payments);
});

export default app;
