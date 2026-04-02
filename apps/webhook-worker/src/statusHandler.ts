/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { createDb } from "@payflow/db";
import {
  getOrderByXenditInvoiceId,
  updateOrderStatus,
  insertWebhookEvent,
  insertAuditLog,
} from "@payflow/db";
import { verifyXenditWebhook } from "@payflow/utils";

type Env = {
  Bindings: {
    // Connection string Neon/Postgres
    DATABASE_URL: string;
    // Token validasi webhook dari Xendit (dibandingkan dengan header x-callback-token)
    XENDIT_WEBHOOK_TOKEN: string;
    // Side effects setelah pembayaran sukses
    NOTIFICATION_QUEUE: Queue;
    SUBSCRIPTION_QUEUE: Queue;
  };
};

// Bentuk payload webhook invoice dari Xendit (kita pakai sebagian field saja)
type XenditBody = {
  // invoice id (unik per invoice) - dipakai untuk mapping ke orders.xenditInvoiceId
  id: string;
  // status invoice dari Xendit
  status: "PAID" | "EXPIRED" | "FAILED" | string;
  // external_id (di sistem ini = idempotency key order, dibuat saat checkout)
  external_id: string;
  amount?: number;
  paid_at?: string;
  payer_email?: string;
  [key: string]: unknown;
};

// Status terminal: kalau order sudah final, jangan diubah lagi
const FINAL_STATUSES = ["paid", "failed", "expired"] as const;

function mapEventType(
  status: string
): "invoice.paid" | "invoice.expired" | "invoice.payment_failed" {
  if (status === "PAID") return "invoice.paid";
  if (status === "EXPIRED") return "invoice.expired";
  return "invoice.payment_failed";
}

function mapOrderStatus(status: string): "paid" | "expired" | "failed" {
  if (status === "PAID") return "paid";
  if (status === "EXPIRED") return "expired";
  return "failed";
}

// Route handler khusus webhook HTTP dari Xendit
const app = new Hono<Env>();

app.post("/webhook/xendit", async (c) => {
  // Step 1 — Verify token (wajib supaya tidak bisa di-spam orang lain)
  const token = c.req.header("x-callback-token") ?? "";
  if (!verifyXenditWebhook(token, c.env.XENDIT_WEBHOOK_TOKEN)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Step 2 — Parse body
  const body = await c.req.json<XenditBody>();
  console.log("[statusHandler] Received event:", body.id, body.status);

  const db = createDb(c.env.DATABASE_URL);

  // Step 3 — Deduplication / idempotency:
  // Xendit bisa mengirim event yang sama lebih dari sekali, jadi kita simpan event id ke tabel webhook_events.
  try {
    await insertWebhookEvent(db, {
      id: body.id,
      type: mapEventType(body.status),
      xenditInvoiceId: body.id,
      payload: body,
    });
  } catch {
    // Unique constraint violation → already processed → idempotent response
    console.log("[statusHandler] Duplicate event skipped:", body.id);
    return c.json({ ok: true });
  }

  // Step 4 — Find order:
  // Setelah payment-worker membuat invoice, ia menyimpan invoice.id ke orders.xenditInvoiceId.
  const order = await getOrderByXenditInvoiceId(db, body.id);
  if (!order) {
    console.error("[statusHandler] Order not found for invoice:", body.id);
    return c.json({ error: "Order not found" }, 404);
  }

  // Step 5 — Safety: skip jika sudah status final (hindari status "bolak-balik" karena event terlambat)
  if ((FINAL_STATUSES as readonly string[]).includes(order.status)) {
    console.log("[statusHandler] Order already final, skipping:", order.id, order.status);
    return c.json({ ok: true });
  }

  // Step 6 — Map status dari Xendit → status internal kita, lalu update orders.status
  const newStatus = mapOrderStatus(body.status);
  await updateOrderStatus(db, order.id, newStatus, body.paid_at);

  // Step 7 — Audit log: catat perubahan status untuk trace/debug
  await insertAuditLog(db, {
    entityType: "order",
    entityId: order.id,
    action: "status_changed",
    oldStatus: order.status,
    newStatus,
    source: "webhook",
    webhookEventId: body.id,
  });

  // Step 8 — Side effects jika paid
  if (newStatus === "paid") {
    await c.env.NOTIFICATION_QUEUE.send({
      type: "email_payment_success",
      orderId: order.id,
      userId: order.userId,
    });

    // Step 9 — Kalau order terkait subscription, trigger aktivasi subscription
    if (order.subscriptionId) {
      await c.env.SUBSCRIPTION_QUEUE.send({
        type: "activate",
        subscriptionId: order.subscriptionId,
        userId: order.userId,
      });
    }
  }

  console.log(`[statusHandler] Order ${order.id} → ${newStatus}`);
  return c.json({ ok: true });
});

// Export Hono app untuk di-mount oleh `apps/webhook-worker/src/index.ts`
export default app;
