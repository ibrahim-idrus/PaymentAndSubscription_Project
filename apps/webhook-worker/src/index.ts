/// <reference types="@cloudflare/workers-types" />
import { createDb, webhookEvents, orders, auditLogs } from "@payflow/db";
import { verifyXenditWebhook } from "@payflow/utils";
import { eq } from "drizzle-orm";

export interface Env {
  DATABASE_URL: string;
  XENDIT_WEBHOOK_TOKEN: string;
  PAYMENT_QUEUE: Queue;
  SUBSCRIPTION_QUEUE: Queue;
  NOTIFICATION_QUEUE: Queue;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const token = request.headers.get("x-callback-token") ?? "";
    if (!verifyXenditWebhook(token, env.XENDIT_WEBHOOK_TOKEN)) {
      return new Response("Unauthorized", { status: 401 });
    }
    return new Response("OK", { status: 200 });
  },

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    const db = createDb(env.DATABASE_URL);

    for (const msg of batch.messages) {
      try {
        const event = msg.body as XenditWebhookEvent;

        // 1. DEDUP — coba insert event ID
        // Kalau sudah ada → unique violation → skip
        try {
          await db.insert(webhookEvents).values({
            id: event.id,
            type: event.status === "PAID" ? "invoice.paid" : "invoice.expired",
            xenditInvoiceId: event.external_id,
            payload: event,
          });
        } catch {
          // Duplicate — sudah diproses sebelumnya, skip
          msg.ack();
          continue;
        }

        // 2. Update order berdasarkan status
        if (event.status === "PAID") {
          await db
            .update(orders)
            .set({ status: "paid", paidAt: new Date().toISOString() })
            .where(eq(orders.xenditInvoiceId, event.id));

          // 3. Push ke subscription queue untuk activate
          await env.SUBSCRIPTION_QUEUE.send({
            type: "activate",
            xenditInvoiceId: event.id,
          });

          // 4. Push ke notification queue untuk kirim email
          await env.NOTIFICATION_QUEUE.send({
            type: "email_payment_success",
            xenditInvoiceId: event.id,
          });
        }

        if (event.status === "EXPIRED") {
          await db
            .update(orders)
            .set({ status: "expired" })
            .where(eq(orders.xenditInvoiceId, event.id));
        }

        // 5. Tulis audit log
        await db.insert(auditLogs).values({
          entityType: "order",
          entityId: event.id,
          action: "status_changed",
          newStatus: event.status.toLowerCase(),
          source: "webhook",
          webhookEventId: event.id,
        });

        msg.ack();
      } catch (err) {
        console.error("[webhook-worker] Processing failed:", err);
        msg.retry();
      }
    }
  },
};

type XenditWebhookEvent = {
  id: string;
  external_id: string;
  status: string;
  [key: string]: unknown;
};
