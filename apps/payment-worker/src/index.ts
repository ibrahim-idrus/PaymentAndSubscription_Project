/// <reference types="@cloudflare/workers-types" />
import { processPayment, ProcessPaymentEnv } from "./processPayment";

export interface Env extends ProcessPaymentEnv {
  SUBSCRIPTION_QUEUE: Queue;
  NOTIFICATION_QUEUE: Queue;
}

export default {
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const job = msg.body as { type: string; orderId: string };

      switch (job.type) {
        case "process-payment":
          await processPayment(msg as Message<{ type: "process-payment"; orderId: string }>, env);
          break;

        case "refund":
          // TODO: implement refund via Xendit
          console.log("[payment-worker] Refund job received for:", job.orderId);
          msg.ack();
          break;

        default:
          console.warn("[payment-worker] Unknown job type:", job.type);
          msg.ack();
      }
    }
  },
};
