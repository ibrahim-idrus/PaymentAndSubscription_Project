/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { handleInvoiceEvent, InvoiceHandlerEnv } from "./invoiceHandler";
import statusHandler from "./statusHandler";

// Env untuk webhook-worker:
// - DATABASE_URL untuk update status order
// - XENDIT_WEBHOOK_TOKEN untuk verifikasi signature/token request webhook
// - Queue bindings untuk meneruskan side-effect (payment/subscription/notification)
export interface Env extends InvoiceHandlerEnv {
  XENDIT_WEBHOOK_TOKEN: string;
  PAYMENT_QUEUE: Queue;
  SUBSCRIPTION_QUEUE: Queue;
}

// Hono app untuk menangani HTTP webhook langsung dari Xendit:
// POST /webhook/xendit -> verifikasi token -> update status order
const app = new Hono<{ Bindings: Env }>();
app.route("/", statusHandler);

export default {
  // HTTP handler (Xendit memanggil webhook URL worker ini)
  fetch: app.fetch.bind(app),

  // Queue handler (opsional):
  // Kalau ada sistem lain yang menaruh event webhook mentah ke queue "webhook-jobs",
  // worker ini juga bisa memproses event itu lewat `handleInvoiceEvent`.
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      await handleInvoiceEvent(msg as Message<any>, env);
    }
  },
};
