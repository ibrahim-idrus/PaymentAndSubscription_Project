/// <reference types="@cloudflare/workers-types" />
import {
  createDb, webhookEvents, orders, auditLogs,
  getCustomerInvoiceByXenditId, updateCustomerInvoiceStatus,
} from "@payflow/db";
import { eq } from "drizzle-orm";

// Env minimum untuk memproses event webhook yang datang dari queue (webhook-jobs)
export interface InvoiceHandlerEnv {
  // Connection string Neon/Postgres
  DATABASE_URL: string;
  // Side effects setelah pembayaran sukses
  NOTIFICATION_QUEUE: Queue;
  SUBSCRIPTION_QUEUE: Queue;
}

// Bentuk message body yang dikirim ke queue webhook-jobs (event invoice dari Xendit)
type XenditInvoiceEvent = {
  // invoice id di Xendit
  id: string;
  // external_id (di sistem ini = idempotency key)
  external_id: string;
  status: "PAID" | "EXPIRED" | "FAILED" | string;
  paid_at?: string;
  [key: string]: unknown;
};

// Map status Xendit → status internal order
const statusMap: Record<string, "paid" | "expired" | "failed"> = {
  PAID: "paid",
  EXPIRED: "expired",
  FAILED: "failed",
};

// Handler untuk memproses 1 event invoice:
// - deduplicate via webhook_events
// - update orders.status
// - write audit log
// - enqueue side effects (notification + subscription activation)
export async function handleInvoiceEvent(
  msg: Message<XenditInvoiceEvent>,
  env: InvoiceHandlerEnv
): Promise<void> {
  const event = msg.body;
  const db = createDb(env.DATABASE_URL);

  try {
    // 1. Deduplication — insert event record; if PK conflict, skip (already processed)
    try {
      await db.insert(webhookEvents).values({
        id: event.id,
        type:
          event.status === "PAID"
            ? "invoice.paid"
            : event.status === "EXPIRED"
              ? "invoice.expired"
              : "invoice.payment_failed",
        xenditInvoiceId: event.id,
        payload: event,
      });
    } catch {
      console.log("[invoiceHandler] Duplicate event, skipping:", event.id);
      msg.ack();
      return;
    }

    // 2. Find order by xendit invoice ID
    const order = await db.query.orders.findFirst({
      where: eq(orders.xenditInvoiceId, event.id),
    });

    const mappedStatus = statusMap[event.status] ?? "failed";

    // 2b. Fallback: cek customer_invoices (flow invoice manual admin)
    if (!order) {
      const customerInvoice = await getCustomerInvoiceByXenditId(db, event.id);
      if (!customerInvoice) {
        console.error("[invoiceHandler] No order or customer invoice found for invoice:", event.id);
        msg.ack();
        return;
      }

      await updateCustomerInvoiceStatus(db, customerInvoice.id, mappedStatus, event.paid_at);

      await db.insert(auditLogs).values({
        entityType: "order",
        entityId: customerInvoice.id,
        action: "status_changed",
        oldStatus: customerInvoice.status,
        newStatus: mappedStatus,
        source: "webhook",
        webhookEventId: event.id,
      });

      console.log(`[invoiceHandler] CustomerInvoice ${customerInvoice.id} updated to: ${mappedStatus}`);
      msg.ack();
      return;
    }

    // 3. Update order status
    await db
      .update(orders)
      .set({
        status: mappedStatus,
        ...(mappedStatus === "paid"
          ? { paidAt: event.paid_at ?? new Date().toISOString() }
          : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, order.id));

    // 4. Write audit log
    await db.insert(auditLogs).values({
      entityType: "order",
      entityId: order.id,
      action: "status_changed",
      oldStatus: "pending",
      newStatus: mappedStatus,
      source: "webhook",
      webhookEventId: event.id,
    });

    // 5. Notify on successful payment
    if (mappedStatus === "paid") {
      await env.NOTIFICATION_QUEUE.send({
        type: "email_payment_success",
        orderId: order.id,
      });

      // 6. Activate subscription if this order is linked to one
      if (order.subscriptionId) {
        await env.SUBSCRIPTION_QUEUE.send({
          type: "activate",
          subscriptionId: order.subscriptionId,
          userId: order.userId,
        });
      }
    }

    console.log(`[invoiceHandler] Order ${order.id} updated to: ${mappedStatus}`);
    msg.ack();
  } catch (err) {
    console.error("[invoiceHandler] DB error:", err);
    msg.retry();
  }
}
