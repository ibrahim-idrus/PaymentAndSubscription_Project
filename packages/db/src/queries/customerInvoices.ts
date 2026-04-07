import { eq } from "drizzle-orm";
import { customerInvoices } from "../schema";
import type { Db } from "../index";

export type CustomerInvoice = typeof customerInvoices.$inferSelect;

// Ambil customer invoice berdasarkan xendit invoice id
// Dipakai webhook-worker sebagai fallback ketika invoice bukan dari flow orders
export async function getCustomerInvoiceByXenditId(
  db: Db,
  xenditInvoiceId: string
): Promise<CustomerInvoice | null> {
  return (
    (await db.query.customerInvoices.findFirst({
      where: eq(customerInvoices.xenditInvoiceId, xenditInvoiceId),
    })) ?? null
  );
}

// Update status customer invoice setelah webhook diterima dari Xendit
export async function updateCustomerInvoiceStatus(
  db: Db,
  invoiceId: string,
  status: "paid" | "expired" | "failed",
  paidAt?: string
): Promise<void> {
  await db
    .update(customerInvoices)
    .set({
      status,
      ...(status === "paid" && paidAt ? { paidAt } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(customerInvoices.id, invoiceId));
}
