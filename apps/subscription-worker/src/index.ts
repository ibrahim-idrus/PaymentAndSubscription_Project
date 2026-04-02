/// <reference types="@cloudflare/workers-types" />
import { activateSubscription, ActivateHandlerEnv } from "./activateHandler";

// subscription-worker adalah consumer untuk queue "subscription-jobs".
// Trigger utamanya datang dari webhook-worker setelah pembayaran sukses:
// { type: "activate", subscriptionId, userId }
export interface Env extends ActivateHandlerEnv {
  DATABASE_URL: string;
  NOTIFICATION_QUEUE: Queue;
}

type SubscriptionJob =
  | { type: "activate"; subscriptionId: string; userId: string }
  | { type: "cancel"; subscriptionId: string; reason?: string }
  | { type: "renew"; subscriptionId: string };

export default {
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const job = message.body as SubscriptionJob;
      try {
        switch (job.type) {
          case "activate":
            // activateSubscription handles its own ack/retry
            await activateSubscription(message as Message<any>, env);
            break;
          case "cancel":
            // TODO: implement cancel logic in DB
            console.log("[subscription-worker] Cancelling subscription:", job.subscriptionId);
            message.ack();
            break;
          case "renew":
            // TODO: implement renew logic (extend period) in DB
            console.log("[subscription-worker] Renewing subscription:", job.subscriptionId);
            message.ack();
            break;
          default:
            console.warn("[subscription-worker] Unknown job type:", (job as { type: string }).type);
            message.ack();
        }
      } catch (err) {
        console.error("[subscription-worker] Unhandled error:", err);
        message.retry();
      }
    }
  },
};
