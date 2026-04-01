/// <reference types="@cloudflare/workers-types" />
import { createDb, orders, users } from "@payflow/db";
import { createInvoice } from "@payflow/utils";
import { eq } from "drizzle-orm";

export interface Env {
  DATABASE_URL: string;
  XENDIT_SECRET_KEY: string;
  SUBSCRIPTION_QUEUE: Queue;
  NOTIFICATION_QUEUE: Queue;
}

export default {
// akan jalan ketika ada queue yg masuk
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    const db = createDb(env.DATABASE_URL);
// dia yg akan ngrim job job
    for (const message of batch.messages) {
      try {
        const job = message.body as PaymentJob;

        switch (job.type) {
          case "process-payment": {
            // 1. Ambil order dari DB
            const order = await db.query.orders.findFirst({
              where: eq(orders.id, job.orderId),
            });

            if (!order) {
              console.error("[payment-worker] Order not found:", job.orderId);
              message.ack();
              break;
            }

            // 2. Ambil email user untuk invoice
            const user = await db.query.users.findFirst({
              where: eq(users.id, order.userId),
            });

            // 3. Buat invoice di Xendit
            const invoice = await createInvoice(env.XENDIT_SECRET_KEY, {
              external_id: order.idempotencyKey,
              amount: Number(order.amount),
              payer_email: user?.email,
              description: order.description ?? `Order ${order.id}`,
              currency: order.currency,
            });

            // 4. Update order di DB dengan xendit_invoice_id + payment_url
            await db
              .update(orders)
              .set({
                xenditInvoiceId: invoice.id,
                invoiceUrl: invoice.invoice_url,
                expiresAt: invoice.expiry_date,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(orders.id, job.orderId));

            console.log("[payment-worker] Invoice created:", invoice.id, invoice.invoice_url);
            break;
          }

          case "refund":
            // TODO: process refund via Xendit
            console.log("[payment-worker] Processing refund:", job.orderId);
            break;

          default:
            console.warn("[payment-worker] Unknown job type:", (job as { type: string }).type);
        }

        message.ack();
      } catch (err) {
        console.error("[payment-worker] Failed:", err);
        message.retry();
      }
    }
  },
};

type PaymentJob =
  | { type: "process-payment"; orderId: string }
  | { type: "refund"; orderId: string; reason: string };
