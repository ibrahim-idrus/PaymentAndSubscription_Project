export interface Env {
  DATABASE_URL: string;
}

export default {
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const job = message.body as NotificationJob;

        switch (job.type) {
          case "payment-success":
            // TODO: send payment success email
            console.log("[notification-worker] Payment success email →", job.email);
            break;

          case "payment-failed":
            // TODO: send payment failed email
            console.log("[notification-worker] Payment failed email →", job.email);
            break;

          case "subscription-activated":
            // TODO: send subscription welcome email
            console.log("[notification-worker] Subscription activated email →", job.email);
            break;

          case "subscription-cancelled":
            // TODO: send cancellation email
            console.log("[notification-worker] Subscription cancelled email →", job.email);
            break;

          case "renewal-reminder":
            // TODO: send renewal reminder email
            console.log("[notification-worker] Renewal reminder email →", job.email);
            break;

          default:
            console.warn("[notification-worker] Unknown job type:", job.type);
        }

        message.ack();
      } catch (err) {
        console.error("[notification-worker] Failed:", err);
        message.retry();
      }
    }
  },
};

type NotificationJob = {
  type: "payment-success" | "payment-failed" | "subscription-activated" | "subscription-cancelled" | "renewal-reminder";
  email: string;
  userId: string;
  metadata?: Record<string, unknown>;
};
