/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { createDb, getAllActivePlans, getPlanById, createPlan } from "@payflow/db";

type Env = { Bindings: { DATABASE_URL: string } };

const app = new Hono<Env>();

// GET /plans — all active plans
app.get("/plans", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const plans = await getAllActivePlans(db);
    return c.json({ data: plans });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

// GET /plans/:id — single plan
app.get("/plans/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const db = createDb(c.env.DATABASE_URL);
    const plan = await getPlanById(db, id);
    if (!plan) {
      return c.json({ error: { code: "NOT_FOUND", message: "Plan not found" } }, 404);
    }
    return c.json({ data: plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

// POST /plans — admin: create plan
app.post("/plans", async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      description?: string;
      price: number;
      currency?: string;
      billingCycle: "monthly" | "yearly";
      trialDays?: number;
      metadata?: Record<string, unknown>;
    }>();

    if (!body.name || body.price == null || !body.billingCycle) {
      return c.json(
        { error: { code: "INVALID_INPUT", message: "name, price, and billingCycle are required" } },
        400
      );
    }

    const db = createDb(c.env.DATABASE_URL);
    const plan = await createPlan(db, { ...body, price: String(body.price) });
    return c.json({ data: plan }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

export default app;
