/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { handleInvoiceEvent, InvoiceHandlerEnv } from "./invoiceHandler";
import statusHandler from "./statusHandler";

export interface Env extends InvoiceHandlerEnv {
  XENDIT_WEBHOOK_TOKEN: string;
  PAYMENT_QUEUE: Queue;
  SUBSCRIPTION_QUEUE: Queue;
}

// Hono app handles direct HTTP webhook calls from Xendit
const app = new Hono<{ Bindings: Env }>();
app.route("/", statusHandler);

export default {
  // HTTP: Xendit calls webhook-worker directly
  fetch: app.fetch.bind(app),

  // Queue: api-gateway pushes webhook events here (existing path)
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      await handleInvoiceEvent(msg as Message<any>, env);
    }
  },
};
