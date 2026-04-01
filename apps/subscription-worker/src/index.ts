/// <reference types="@cloudflare/workers-types" />
import { createDb } from "@payflow/db";

export interface Env {
  DATABASE_URL: string;
  NOTIFICATION_QUEUE: Queue;
}

export default {
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    const db = createDb(env.DATABASE_URL);

    for (const message of batch.messages) {
      try {
        const job = message.body as SubscriptionJob;

        switch (job.type) {
          case "activate":
            // TODO: activate subscription in DB
            console.log("[subscription-worker] Activating subscription:", job.subscriptionId);
            break;

          case "cancel":
            // TODO: mark subscription as cancelled in DB
            console.log("[subscription-worker] Cancelling subscription:", job.subscriptionId);
            break;

          case "renew":
            // TODO: renew subscription period in DB
            console.log("[subscription-worker] Renewing subscription:", job.subscriptionId);
            break;

          default:
            console.warn("[subscription-worker] Unknown job type:", (job as { type: string }).type);
        }

        message.ack();
      } catch (err) {
        console.error("[subscription-worker] Failed:", err);
        message.retry();
      }
    }
  },
};

type SubscriptionJob =
  | { type: "activate"; subscriptionId: string; userId: string }
  | { type: "cancel"; subscriptionId: string; reason?: string }
  | { type: "renew"; subscriptionId: string };
