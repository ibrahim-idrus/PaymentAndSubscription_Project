import { createDb } from "@payflow/db";

export interface Env {
  DATABASE_URL: string;
  PAYMENT_QUEUE: Queue;
  SUBSCRIPTION_QUEUE: Queue;
}

export default {
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    const db = createDb(env.DATABASE_URL);

    for (const message of batch.messages) {
      try {
        const event = message.body as WebhookJob;

        switch (event.type) {
          case "invoice.paid":
            // TODO: mark order as paid, enqueue subscription activation
            console.log("[webhook-worker] Invoice paid:", event.xenditInvoiceId);
            await env.SUBSCRIPTION_QUEUE.send({ type: "activate", subscriptionId: event.subscriptionId, userId: event.userId });
            break;

          case "invoice.expired":
          case "invoice.payment_failed":
            // TODO: mark order as failed
            console.log("[webhook-worker] Invoice failed/expired:", event.xenditInvoiceId);
            break;

          case "recurring_payment.made":
            await env.SUBSCRIPTION_QUEUE.send({ type: "renew", subscriptionId: event.subscriptionId });
            break;

          case "recurring_payment.missed":
          case "recurring_payment.failed":
            await env.SUBSCRIPTION_QUEUE.send({ type: "cancel", subscriptionId: event.subscriptionId, reason: event.type });
            break;

          default:
            console.warn("[webhook-worker] Unknown event type:", event.type);
        }

        message.ack();
      } catch (err) {
        console.error("[webhook-worker] Failed:", err);
        message.retry();
      }
    }
  },
};

type WebhookJob = {
  type: string;
  xenditInvoiceId: string;
  subscriptionId: string;
  userId: string;
};
