/// <reference types="@cloudflare/workers-types" />
import { createDb, orders, users } from "@payflow/db";
import { createInvoice, XenditError } from "@payflow/utils";
import { eq } from "drizzle-orm";

export interface ProcessPaymentEnv {
  DATABASE_URL: string;
  XENDIT_SECRET_KEY: string;
  FRONTEND_URL?: string;
}

type PaymentMessage = {
  type: "process-payment";
  orderId: string;
};

export async function processPayment(
  msg: Message<PaymentMessage>,
  env: ProcessPaymentEnv
): Promise<void> {
  const { orderId } = msg.body;
  const db = createDb(env.DATABASE_URL);

  // 1. Fetch order from DB
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  });
  if (!order) {
    console.error("[processPayment] Order not found:", orderId);
    msg.ack();
    return;
  }

  // 2. Fetch user for payer_email
  const user = await db.query.users.findFirst({
    where: eq(users.id, order.userId),
  });

  try {
    // 3. Create Xendit invoice (1 week expiry)
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

    // 4. Update order with invoice data (status stays "pending" — changes via webhook)
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
    msg.ack();
  } catch (err) {
    if (err instanceof XenditError) {
      console.error("[processPayment] Xendit error:", err.errorCode, err.httpStatus, err.message);
    } else {
      console.error("[processPayment] Unexpected error:", err);
    }
    msg.retry();
  }
}
