/// <reference types="@cloudflare/workers-types" />
import { processPayment, ProcessPaymentEnv } from "./processPayment";

// Env untuk payment-worker:
// - mewarisi env yang dibutuhkan proses pembayaran (DB + Xendit)
// - punya producer bindings untuk meneruskan job ke queue lain (subscription/notification)
export interface Env extends ProcessPaymentEnv {
  SUBSCRIPTION_QUEUE: Queue;
  NOTIFICATION_QUEUE: Queue;
}

export default {
  // Handler Cloudflare Queues: dipanggil otomatis ketika ada message masuk ke queue yang di-consume worker ini
  // (lihat `[[queues.consumers]]` di `apps/payment-worker/wrangler.toml`)
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    // Batch bisa berisi beberapa message; proses satu-per-satu supaya error tidak "menggagalkan" semuanya.
    for (const msg of batch.messages) {
      // Format message minimal: ada `type` dan `orderId`
      const job = msg.body as { type: string; orderId: string };

      switch (job.type) {
        case "process-payment":
          // Buat invoice ke Xendit + simpan paymentUrl/xenditInvoiceId ke tabel orders
          await processPayment(msg as Message<{ type: "process-payment"; orderId: string }>, env);
          break;

        case "refund":
          // TODO: implement refund via Xendit
          console.log("[payment-worker] Refund job received for:", job.orderId);
          // Job refund belum diimplement, jadi kita ack supaya tidak retry terus-menerus
          msg.ack();
          break;

        default:
          console.warn("[payment-worker] Unknown job type:", job.type);
          // Unknown job -> ack biar message tidak nyangkut / retry tanpa akhir
          msg.ack();
      }
    }
  },
};
