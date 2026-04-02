/// <reference types="@cloudflare/workers-types" />
import {
  createDb,
  getPlanById,
  getSubscriptionById,
  updateSubscription,
  insertAuditLog,
} from "@payflow/db";

export interface ActivateHandlerEnv {
  DATABASE_URL: string;
  NOTIFICATION_QUEUE: Queue;
}

type ActivateJob = { type: "activate"; subscriptionId: string; userId: string };

export async function activateSubscription(
  msg: Message<ActivateJob>,
  env: ActivateHandlerEnv
): Promise<void> {
  const { subscriptionId, userId } = msg.body;
  const db = createDb(env.DATABASE_URL);

  try {
    const sub = await getSubscriptionById(db, subscriptionId);
    if (!sub) {
      console.warn("[activateHandler] Subscription not found:", subscriptionId);
      msg.ack();
      return;
    }

    if (sub.status === "active") {
      console.log("[activateHandler] Already active, skipping:", subscriptionId);
      msg.ack();
      return;
    }

    const plan = await getPlanById(db, sub.planId);
    const now = new Date();
    const periodEnd = new Date(now);
    if (plan?.billingCycle === "monthly") {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    await updateSubscription(db, subscriptionId, {
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      renewsAt: periodEnd.toISOString(),
    });

    await insertAuditLog(db, {
      entityType: "subscription",
      entityId: subscriptionId,
      action: "status_changed",
      oldStatus: sub.status,
      newStatus: "active",
      source: "webhook",
    });

    await env.NOTIFICATION_QUEUE.send({
      type: "email_subscription_activated",
      subscriptionId,
      userId,
    });

    console.log(`[activateHandler] Subscription ${subscriptionId} → active`);
    msg.ack();
  } catch (err) {
    console.error("[activateHandler] Error:", err);
    msg.retry();
  }
}
