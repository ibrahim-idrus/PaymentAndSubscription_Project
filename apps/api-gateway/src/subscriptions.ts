/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import {
  createDb,
  users,
  orders,
  getPlanById,
  createSubscription,
  getActiveSubscriptionByUserId,
  getSubscriptionById,
  updateSubscription,
  getOrdersByUserId,
  insertAuditLog,
} from "@payflow/db";
import { generateIdempotencyKey } from "@payflow/utils";

type Env = {
  Bindings: {
    // Connection string database (Neon/Postgres)
    DATABASE_URL: string;
    // Queue untuk proses pembayaran subscription (invoice dibuat oleh payment-worker)
    PAYMENT_QUEUE: Queue;
  };
};

// Route untuk lifecycle subscription:
// - subscribe (trial atau paid)
// - fetch status subscription + billing history
// - upgrade/downgrade/cancel
const app = new Hono<Env>();

// ─── GET /subscriptions/user/:userId ─────────────────────────────────────────

app.get("/subscriptions/user/:userId", async (c) => {
  const userId = c.req.param("userId");
  try {
    const db = createDb(c.env.DATABASE_URL);
    // Ambil subscription aktif user (active/trialing/past_due)
    const subscription = await getActiveSubscriptionByUserId(db, userId);
    if (!subscription) {
      return c.json({ data: null, billingHistory: [] });
    }
    // Ambil plan untuk kebutuhan UI
    const plan = await getPlanById(db, subscription.planId);
    // Ambil order terakhir sebagai billing history
    const billingHistory = await getOrdersByUserId(db, userId, 10);
    return c.json({ data: { subscription, plan }, billingHistory });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

// ─── POST /subscriptions — Subscribe to a plan ────────────────────────────────

app.post("/subscriptions", async (c) => {
  try {
    // Frontend mengirim userId + planId (lihat `apps/web/src/pages/PlansPage.tsx`)
    const body = await c.req.json<{ userId: string; planId: string }>();

    if (!body.userId || !body.planId) {
      return c.json(
        { error: { code: "INVALID_INPUT", message: "userId and planId are required" } },
        400
      );
    }

    const db = createDb(c.env.DATABASE_URL);

    // Validasi: user harus ada
    const user = await db.query.users.findFirst({ where: eq(users.id, body.userId) });
    if (!user) {
      return c.json({ error: { code: "NOT_FOUND", message: "User not found" } }, 404);
    }

    // Validasi: plan harus ada
    const plan = await getPlanById(db, body.planId);
    if (!plan) {
      return c.json({ error: { code: "NOT_FOUND", message: "Plan not found" } }, 404);
    }

    // Cegah double-subscribe jika masih ada subscription aktif
    const existing = await getActiveSubscriptionByUserId(db, body.userId);
    if (existing) {
      return c.json(
        { error: { code: "CONFLICT", message: "User already has an active subscription" } },
        409
      );
    }

    const now = new Date();

    // Trial flow: tidak perlu pembayaran (langsung trialing sampai trialEnd)
    if (plan.trialDays > 0) {
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + plan.trialDays);

      const sub = await createSubscription(db, {
        userId: body.userId,
        planId: body.planId,
        status: "trialing",
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: trialEnd.toISOString(),
        trialStart: now.toISOString(),
        trialEnd: trialEnd.toISOString(),
        renewsAt: trialEnd.toISOString(),
      });

      await insertAuditLog(db, {
        entityType: "subscription",
        entityId: sub.id,
        action: "created",
        oldStatus: "",
        newStatus: "trialing",
        source: "api",
      });

      return c.json({ data: { subscription: sub, orderId: null } }, 201);
    }

    // Paid flow:
    // - buat subscription status "past_due" (belum aktif sampai payment confirmed via webhook)
    // - buat order dengan subscriptionId
    // - enqueue job pembayaran agar payment-worker membuat invoice Xendit
    const periodEnd = new Date(now);
    if (plan.billingCycle === "monthly") {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const sub = await createSubscription(db, {
      userId: body.userId,
      planId: body.planId,
      status: "past_due",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      renewsAt: periodEnd.toISOString(),
    });

    const idempotencyKey = generateIdempotencyKey("sub-order");
    const [order] = await db
      .insert(orders)
      .values({
        userId: body.userId,
        // Link order -> subscription; dipakai webhook-worker untuk trigger activation saat paid
        subscriptionId: sub.id,
        idempotencyKey,
        amount: String(plan.price),
        currency: plan.currency,
        status: "pending",
        description: `${plan.name} – ${plan.billingCycle} subscription`,
      })
      .returning({ id: orders.id });

    // Proses invoice dilakukan async oleh payment-worker
    await c.env.PAYMENT_QUEUE.send({ type: "process-payment", orderId: order.id });

    await insertAuditLog(db, {
      entityType: "subscription",
      entityId: sub.id,
      action: "created",
      oldStatus: "",
      newStatus: "past_due",
      source: "api",
    });

    return c.json({ data: { subscription: sub, orderId: order.id } }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

// ─── POST /subscriptions/:id/upgrade ─────────────────────────────────────────

app.post("/subscriptions/:id/upgrade", async (c) => {
  const id = c.req.param("id");
  try {
    const { newPlanId } = await c.req.json<{ newPlanId: string }>();
    if (!newPlanId) {
      return c.json({ error: { code: "INVALID_INPUT", message: "newPlanId is required" } }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    const sub = await getSubscriptionById(db, id);
    if (!sub) {
      return c.json({ error: { code: "NOT_FOUND", message: "Subscription not found" } }, 404);
    }

    if (!["active", "trialing", "past_due"].includes(sub.status)) {
      return c.json(
        { error: { code: "INVALID_STATE", message: "Subscription cannot be upgraded in its current state" } },
        400
      );
    }

    const newPlan = await getPlanById(db, newPlanId);
    if (!newPlan) {
      return c.json({ error: { code: "NOT_FOUND", message: "Plan not found" } }, 404);
    }

    // Upgrade langsung: reset period dari hari ini, dan buat order baru untuk pembayaran upgrade
    const now = new Date();
    const periodEnd = new Date(now);
    if (newPlan.billingCycle === "monthly") {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    await updateSubscription(db, id, {
      planId: newPlanId,
      previousPlanId: sub.planId,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      renewsAt: periodEnd.toISOString(),
      cancelAtPeriodEnd: false,
    });

    const idempotencyKey = generateIdempotencyKey("upgrade-order");
    const [order] = await db
      .insert(orders)
      .values({
        userId: sub.userId,
        subscriptionId: sub.id,
        idempotencyKey,
        amount: String(newPlan.price),
        currency: newPlan.currency,
        status: "pending",
        description: `Upgrade to ${newPlan.name} – ${newPlan.billingCycle}`,
      })
      .returning({ id: orders.id });

    // Invoice dibuat async lewat payment-worker
    await c.env.PAYMENT_QUEUE.send({ type: "process-payment", orderId: order.id });

    await insertAuditLog(db, {
      entityType: "subscription",
      entityId: id,
      action: "updated",
      oldStatus: sub.planId,
      newStatus: newPlanId,
      source: "api",
    });

    return c.json({ data: { subscriptionId: id, orderId: order.id } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

// ─── POST /subscriptions/:id/downgrade ───────────────────────────────────────

app.post("/subscriptions/:id/downgrade", async (c) => {
  const id = c.req.param("id");
  try {
    const { newPlanId } = await c.req.json<{ newPlanId: string }>();
    if (!newPlanId) {
      return c.json({ error: { code: "INVALID_INPUT", message: "newPlanId is required" } }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    const sub = await getSubscriptionById(db, id);
    if (!sub) {
      return c.json({ error: { code: "NOT_FOUND", message: "Subscription not found" } }, 404);
    }

    const newPlan = await getPlanById(db, newPlanId);
    if (!newPlan) {
      return c.json({ error: { code: "NOT_FOUND", message: "Plan not found" } }, 404);
    }

    // Downgrade berlaku di akhir periode (tidak membuat order baru).
    // Kita simpan plan target di metadata agar bisa dieksekusi oleh renewal-cron/worker nanti.
    const existingMeta = (sub.metadata as Record<string, unknown>) ?? {};
    await updateSubscription(db, id, {
      cancelAtPeriodEnd: true,
      metadata: { ...existingMeta, pending_downgrade_plan_id: newPlanId },
    });

    await insertAuditLog(db, {
      entityType: "subscription",
      entityId: id,
      action: "updated",
      oldStatus: sub.planId,
      newStatus: newPlanId,
      source: "api",
    });

    return c.json({ data: { subscriptionId: id, downgradesAt: sub.currentPeriodEnd } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

// ─── POST /subscriptions/:id/cancel ──────────────────────────────────────────

app.post("/subscriptions/:id/cancel", async (c) => {
  const id = c.req.param("id");
  try {
    const db = createDb(c.env.DATABASE_URL);

    const sub = await getSubscriptionById(db, id);
    if (!sub) {
      return c.json({ error: { code: "NOT_FOUND", message: "Subscription not found" } }, 404);
    }

    if (sub.cancelAtPeriodEnd) {
      return c.json(
        { error: { code: "ALREADY_CANCELLED", message: "Subscription is already scheduled for cancellation" } },
        400
      );
    }

    // Cancel = set cancelAtPeriodEnd sehingga akses tetap sampai period end
    await updateSubscription(db, id, {
      cancelAtPeriodEnd: true,
      cancelledAt: new Date().toISOString(),
    });

    await insertAuditLog(db, {
      entityType: "subscription",
      entityId: id,
      action: "cancelled",
      oldStatus: sub.status,
      newStatus: "cancelled",
      source: "api",
    });

    return c.json({ data: { subscriptionId: id, accessUntil: sub.currentPeriodEnd } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

export default app;
