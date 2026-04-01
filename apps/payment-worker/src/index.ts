/// <reference types="@cloudflare/workers-types" />
import { createDb } from "@payflow/db";

export interface Env {
  DATABASE_URL: string;
  SUBSCRIPTION_QUEUE: Queue;
  NOTIFICATION_QUEUE: Queue;
}

export default {
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    const db = createDb(env.DATABASE_URL);

    for (const message of batch.messages) {
      try {
        const job = message.body as PaymentJob;

        switch (job.type) {
          case "process-payment":
            // TODO: process payment via Xendit
            console.log("[payment-worker] Processing payment:", job.orderId);
            break;

          case "refund":
            // TODO: process refund via Xendit
            console.log("[payment-worker] Processing refund:", job.orderId);
            break;

          default:
            console.warn("[payment-worker] Unknown job type:", job.type);
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
