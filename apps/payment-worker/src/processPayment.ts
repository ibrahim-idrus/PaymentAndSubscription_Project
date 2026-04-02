// file ini berisi logic consumer process-payment (buat invoice Xendit, simpan paymentUrl, dll). 
/// <reference types="@cloudflare/workers-types" />
import { createDb, orders, users } from "@payflow/db";
import { createInvoice, XenditError } from "@payflow/utils";
import { eq } from "drizzle-orm";

// Env minimum yang dibutuhkan untuk memproses pembuatan invoice pembayaran
export interface ProcessPaymentEnv {
  // Connection string Neon/Postgres
  DATABASE_URL: string;
  // API key secret Xendit untuk create invoice
  XENDIT_SECRET_KEY: string;
  // Optional: dipakai untuk redirect user ke halaman status pembayaran setelah bayar/gagal
  FRONTEND_URL?: string;
}

// Payload message yang dikirim dari api-gateway ke queue "payment-jobs"
type PaymentMessage = {
  type: "process-payment";
  orderId: string;
};

export async function processPayment(
  msg: Message<PaymentMessage>,
  env: ProcessPaymentEnv
): Promise<void> {
  const { orderId } = msg.body;
  // DB client untuk baca/update tabel orders & users
  const db = createDb(env.DATABASE_URL);

  // 1) Ambil order dari DB berdasarkan orderId
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  if (!order) {
    // Kalau order tidak ada, tidak ada yang bisa diproses; ack supaya message tidak retry terus.
    console.error("[processPayment] Order not found:", orderId);
    msg.ack();
    return;
  }

  // 2) Ambil user untuk mengisi payer_email (optional di Xendit)
  const user = await db.query.users.findFirst({
    where: eq(users.id, order.userId),
  });

  try {
    // 3) Buat invoice di Xendit (expiry 1 minggu = 604800 detik)
    // `external_id` memakai `order.idempotencyKey` agar retry aman (tidak buat invoice dobel).
    const invoice = await createInvoice(env.XENDIT_SECRET_KEY, {
      external_id: order.idempotencyKey,
      amount: Number(order.amount),
      payer_email: user?.email,
      description: order.description ?? "PayFlow Payment",
      currency: order.currency ?? "IDR",
      invoice_duration: 604800,
      success_redirect_url: env.FRONTEND_URL
        ? `${env.FRONTEND_URL}/payment/status/${order.id}`
        : undefined,
      failure_redirect_url: env.FRONTEND_URL
        ? `${env.FRONTEND_URL}/payment/status/${order.id}`
        : undefined,
    });

    // 4) Simpan data invoice ke DB.
    // Status order tetap "pending" karena perubahan ke "paid/failed/expired" biasanya datang dari webhook Xendit.
    await db
      .update(orders)
      .set({
        xenditInvoiceId: invoice.id,
        paymentUrl: invoice.invoice_url,
        expiresAt: invoice.expiry_date,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, orderId));

    console.log("[processPayment] Invoice created:", invoice.id, invoice.invoice_url);
    // Sukses -> ack message (hapus dari queue)
    msg.ack();
  } catch (err) {
    if (err instanceof XenditError) {
      console.error("[processPayment] Xendit error:", err.errorCode, err.httpStatus, err.message);
    } else {
      console.error("[processPayment] Unexpected error:", err);
    }
    // Gagal -> retry sesuai max_retries di wrangler.toml
    msg.retry();
  }
}
