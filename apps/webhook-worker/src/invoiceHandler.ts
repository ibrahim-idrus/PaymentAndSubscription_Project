/// <reference types="@cloudflare/workers-types" />
import { createDb, webhookEvents, orders, auditLogs } from "@payflow/db";
import { eq } from "drizzle-orm";

export interface InvoiceHandlerEnv {
  DATABASE_URL: string;
  NOTIFICATION_QUEUE: Queue;
  SUBSCRIPTION_QUEUE: Queue;
}

type XenditInvoiceEvent = {
  id: string;
  external_id: string;
  status: "PAID" | "EXPIRED" | "FAILED" | string;
  paid_at?: string;
  [key: string]: unknown;
};

const statusMap: Record<string, "paid" | "expired" | "failed"> = {
  PAID: "paid",
  EXPIRED: "expired",
  FAILED: "failed",
};

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
    if (!order) {
      console.error("[invoiceHandler] Order not found for invoice:", event.id);
      msg.ack();
      return;
    }

    const mappedStatus = statusMap[event.status] ?? "failed";

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
