/// <reference types="@cloudflare/workers-types" />
import { createDb } from "@payflow/db";

export interface Env {
  DATABASE_URL: string;
  SUBSCRIPTION_QUEUE: Queue;
  PAYMENT_QUEUE: Queue;
  NOTIFICATION_QUEUE: Queue;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log("[renewal-cron] Running at:", new Date().toISOString());

    const db = createDb(env.DATABASE_URL);

    // TODO: query subscriptions due for renewal in next 24h
    // and enqueue renewal + reminder jobs
    console.log("[renewal-cron] Checking subscriptions due for renewal...");

    // Example: enqueue renewal reminders
    // await env.NOTIFICATION_QUEUE.send({ type: "renewal-reminder", email: user.email, userId: user.id });
    // await env.SUBSCRIPTION_QUEUE.send({ type: "renew", subscriptionId: sub.id });

    console.log("[renewal-cron] Done.");
  },
};
