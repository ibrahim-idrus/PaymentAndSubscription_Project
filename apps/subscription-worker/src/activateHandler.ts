/// <reference types="@cloudflare/workers-types" />
import {
  createDb,
  getPlanById,
  getSubscriptionById,
  updateSubscription,
  insertAuditLog,
} from "@payflow/db";

// Env minimum untuk aktivasi subscription setelah pembayaran sukses.
export interface ActivateHandlerEnv {
  // Connection string Neon/Postgres
  DATABASE_URL: string;
  // Side effect: kirim email/notifikasi setelah subscription aktif
  NOTIFICATION_QUEUE: Queue;
}

// Message dari queue "subscription-jobs"
type ActivateJob = { type: "activate"; subscriptionId: string; userId: string };

// Aktivasi subscription:
// - dipanggil oleh subscription-worker saat menerima job { type: "activate" }
// - biasanya job ini di-enqueue oleh webhook-worker ketika order berubah jadi "paid"
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

    // Idempotent: kalau sudah active, jangan diubah lagi
    if (sub.status === "active") {
      console.log("[activateHandler] Already active, skipping:", subscriptionId);
      msg.ack();
      return;
    }

    // Hitung periode baru berdasarkan billingCycle plan saat ini
    const plan = await getPlanById(db, sub.planId);
    const now = new Date();
    const periodEnd = new Date(now);
    if (plan?.billingCycle === "monthly") {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Set subscription menjadi aktif dan set period window
    await updateSubscription(db, subscriptionId, {
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      renewsAt: periodEnd.toISOString(),
    });

    // Audit log untuk perubahan status (trace/debug)
    await insertAuditLog(db, {
      entityType: "subscription",
      entityId: subscriptionId,
      action: "status_changed",
      oldStatus: sub.status,
      newStatus: "active",
      source: "webhook",
    });

    // Side effect: kirim notifikasi ke user
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
