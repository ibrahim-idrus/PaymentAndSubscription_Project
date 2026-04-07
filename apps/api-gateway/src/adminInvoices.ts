// Route pembuatan invoice oleh admin untuk pelanggan.
// POST /api/admin/invoices — buat invoice baru untuk pelanggan yang sudah terdaftar
// GET  /api/admin/invoices — list semua invoice (opsional filter by customerId), disertai data customer
// GET  /api/admin/invoices/:id — detail satu invoice beserta data customer

/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { createDb, customers, customerInvoices } from "@payflow/db";
import { createInvoice, XenditError } from "@payflow/utils";
import { eq, sql } from "drizzle-orm";

type Env = {
  Bindings: {
    DATABASE_URL: string;
    XENDIT_SECRET_KEY: string;
    FRONTEND_URL?: string;
  };
};

const app = new Hono<Env>();

/**
 * Generate reference ID invoice dengan format:
 * {namaPerusahaan}_{namaPelanggan}_{DDMMYYYY}_{NNN}
 * Contoh: acme_Budi_03042026_001
 */
function generateReferenceId(
  companyName: string,
  customerName: string,
  invoiceNumber: number
): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  const num = String(invoiceNumber).padStart(3, "0");

  // Sanitasi: hilangkan karakter non-alphanumeric kecuali underscore, ganti spasi dengan underscore
  const sanitize = (s: string) =>
    s.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");

  const company = sanitize(companyName).toLowerCase();
  const name = sanitize(customerName);

  return `${company}_${name}_${dd}${mm}${yyyy}_${num}`;
}

// POST /api/admin/invoices
// Body: { customerId, amount, currency?, description? }
app.post("/admin/invoices", async (c) => {
  try {
    const body = await c.req.json<{
      customerId: string;
      amount: number;
      currency?: string;
      description?: string;
    }>();

    if (!body.customerId) {
      return c.json({ error: { code: "INVALID_INPUT", message: "customerId wajib diisi" } }, 400);
    }
    if (!body.amount || typeof body.amount !== "number" || body.amount <= 0) {
      return c.json({ error: { code: "INVALID_INPUT", message: "amount harus bilangan positif" } }, 400);
    }

    const db = createDb(c.env.DATABASE_URL);

    // Increment invoiceCount secara atomik lalu ambil data pelanggan terbaru
    const [customer] = await db
      .update(customers)
      .set({
        invoiceCount: sql`${customers.invoiceCount} + 1`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(customers.id, body.customerId))
      .returning();

    if (!customer) {
      return c.json({ error: { code: "CUSTOMER_NOT_FOUND", message: "Pelanggan tidak ditemukan" } }, 404);
    }

    // Generate reference ID menggunakan invoiceCount yang sudah diperbarui
    const referenceId = generateReferenceId(
      customer.companyName ?? customer.name,
      customer.name,
      customer.invoiceCount
    );

    // Buat invoice di Xendit
    const xenditInvoice = await createInvoice(c.env.XENDIT_SECRET_KEY, {
      external_id: referenceId,
      amount: body.amount,
      payer_email: customer.email ?? undefined,
      description: body.description ?? `Invoice ${referenceId}`,
      currency: body.currency ?? "IDR",
      invoice_duration: 604800, // 7 hari
    });

    // Simpan invoice ke DB
    const [invoice] = await db
      .insert(customerInvoices)
      .values({
        customerId: customer.id,
        referenceId,
        xenditInvoiceId: xenditInvoice.id,
        invoiceUrl: xenditInvoice.invoice_url,
        amount: String(body.amount),
        currency: body.currency ?? "IDR",
        status: "pending",
        description: body.description ?? `Invoice ${referenceId}`,
        expiresAt: xenditInvoice.expiry_date,
      })
      .returning();

    return c.json({ data: { invoice, customer } }, 201);
  } catch (err) {
    if (err instanceof XenditError) {
      console.error("[admin/invoices] Xendit error:", err.errorCode, err.message);
      return c.json({ error: { code: err.errorCode, message: err.message } }, 422);
    }
    console.error("[admin/invoices] POST error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

// GET /api/admin/invoices?customerId=
// Mengembalikan invoice beserta data customer (name, email, phoneNumber, phoneCountryCode)
app.get("/admin/invoices", async (c) => {
  try {
    const customerId = c.req.query("customerId");
    const db = createDb(c.env.DATABASE_URL);

    const query = db
      .select({
        id: customerInvoices.id,
        customerId: customerInvoices.customerId,
        referenceId: customerInvoices.referenceId,
        xenditInvoiceId: customerInvoices.xenditInvoiceId,
        invoiceUrl: customerInvoices.invoiceUrl,
        amount: customerInvoices.amount,
        currency: customerInvoices.currency,
        status: customerInvoices.status,
        description: customerInvoices.description,
        expiresAt: customerInvoices.expiresAt,
        paidAt: customerInvoices.paidAt,
        createdAt: customerInvoices.createdAt,
        updatedAt: customerInvoices.updatedAt,
        customerName: customers.name,
        customerEmail: customers.email,
        customerPhone: customers.phoneNumber,
        customerPhoneCountryCode: customers.phoneCountryCode,
        customerCompanyName: customers.companyName,
      })
      .from(customerInvoices)
      .innerJoin(customers, eq(customerInvoices.customerId, customers.id));

    const result = customerId
      ? await query.where(eq(customerInvoices.customerId, customerId))
      : await query;

    return c.json({ data: result });
  } catch (err) {
    console.error("[admin/invoices] GET error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

export default app;
