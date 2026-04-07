// Route untuk manajemen pelanggan (customers) oleh admin.
// POST /api/customers     — buat pelanggan baru (simpan ke DB + daftarkan ke Xendit)
// GET  /api/customers     — list/search pelanggan (beserta status subscription jika ada)
// GET  /api/customers/:id — detail pelanggan beserta daftar invoice + subscription-nya

/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import { createDb, customers, customerInvoices, users, subscriptions, plans } from "@payflow/db";
import { createCustomer, XenditError, type CreateCustomerInput } from "@payflow/utils";
import { eq, or, ilike, and, inArray } from "drizzle-orm";

type Env = {
  Bindings: {
    DATABASE_URL: string;
    XENDIT_SECRET_KEY: string;
  };
};

const app = new Hono<Env>();

// POST /api/customers
// Body: { name, companyName?, email?, phoneNumber?, phoneCountryCode?, type? }
app.post("/customers", async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      companyName?: string;
      email?: string;
      phoneNumber?: string;
      phoneCountryCode?: string;
      type?: "INDIVIDUAL" | "BUSINESS";
    }>();

    if (!body.name?.trim()) {
      return c.json({ error: { code: "INVALID_INPUT", message: "name wajib diisi" } }, 400);
    }

    // buat nanti pakai "db" nya aja
    const db = createDb(c.env.DATABASE_URL);

    // Simpan/insert ke DB dulu untuk dapat UUID yang akan dipakai sebagai reference_id Xendit
    const [customer] = await db
      .insert(customers)
      .values({
        name: body.name.trim(),
        companyName: body.companyName?.trim() || null,
        email: body.email?.trim() || null,
        phoneNumber: body.phoneNumber?.trim() || null,
        phoneCountryCode: body.phoneCountryCode ?? "+62",
        type: body.type ?? "INDIVIDUAL",
      })
      .returning();

    // Bangun payload Xendit sesuai tipe pelanggan, buat insert data yg diatas ke xendit
    const xenditPayload: CreateCustomerInput = {
      reference_id: customer.id, // UUID internal sebagai reference unik di Xendit
      type: customer.type,
    };

    if (customer.type === "INDIVIDUAL") {
      xenditPayload.individual_detail = { given_names: customer.name };
    } else {
      xenditPayload.business_detail = { business_name: customer.name };
    }

    if (customer.email) xenditPayload.email = customer.email;
    if (customer.phoneNumber) {
      xenditPayload.mobile_number = `${customer.phoneCountryCode}${customer.phoneNumber}`;
    }

    // Daftarkan ke Xendit atau manggil xendit
    const xenditCustomer = await createCustomer(c.env.XENDIT_SECRET_KEY, xenditPayload);

    // Simpan xenditCustomerId ke DB
    const [updated] = await db
      .update(customers)
      .set({
        xenditCustomerId: xenditCustomer.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(customers.id, customer.id))
      .returning();

    return c.json({ data: updated }, 201);
  } catch (err) {
    if (err instanceof XenditError) {
      console.error("[customers] Xendit error:", err.errorCode, err.message);
      return c.json({ error: { code: err.errorCode, message: err.message } }, 422);
    }
    console.error("[customers] POST error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

// GET /api/customers?search=
// Query param `search` mencari berdasarkan nama atau nama perusahaan.
// Response juga menyertakan info subscription aktif pelanggan (jika ada),
// diperoleh dengan join: customers.email → users.email → subscriptions → plans.
app.get("/customers", async (c) => {
  try {
    const search = c.req.query("search")?.trim();
    const db = createDb(c.env.DATABASE_URL);

    const activeStatuses = ["active", "trialing", "past_due"] as const;

    const query = db
      .select({
        id: customers.id,
        name: customers.name,
        companyName: customers.companyName,
        email: customers.email,
        phoneNumber: customers.phoneNumber,
        phoneCountryCode: customers.phoneCountryCode,
        type: customers.type,
        xenditCustomerId: customers.xenditCustomerId,
        invoiceCount: customers.invoiceCount,
        createdAt: customers.createdAt,
        // Subscription fields (null jika tidak punya subscription aktif)
        subscriptionId: subscriptions.id,
        planName: plans.name,
        subscriptionStatus: subscriptions.status,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(customers)
      .leftJoin(users, eq(customers.email, users.email))
      .leftJoin(
        subscriptions,
        and(
          eq(subscriptions.userId, users.id),
          inArray(subscriptions.status, activeStatuses)
        )
      )
      .leftJoin(plans, eq(plans.id, subscriptions.planId));

    const result = search
      ? await query.where(
          or(ilike(customers.name, `%${search}%`), ilike(customers.companyName, `%${search}%`))
        )
      : await query;

    return c.json({ data: result });
  } catch (err) {
    console.error("[customers] GET error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

// GET /api/customers/:id
// Mengembalikan detail pelanggan beserta seluruh invoice + subscription aktif-nya
app.get("/customers/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const db = createDb(c.env.DATABASE_URL);

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id));

    if (!customer) {
      return c.json({ error: { code: "CUSTOMER_NOT_FOUND", message: "Pelanggan tidak ditemukan" } }, 404);
    }

    const invoices = await db
      .select()
      .from(customerInvoices)
      .where(eq(customerInvoices.customerId, id));

    // Cari subscription aktif via email: customers.email → users.email → subscriptions → plans
    let subscription: {
      subscriptionId: string;
      planName: string | null;
      subscriptionStatus: string;
      currentPeriodStart: string;
      currentPeriodEnd: string;
      cancelAtPeriodEnd: boolean;
    } | null = null;

    if (customer.email) {
      const user = await db.query.users.findFirst({ where: eq(users.email, customer.email) });
      if (user) {
        const [row] = await db
          .select({
            subscriptionId: subscriptions.id,
            planName: plans.name,
            subscriptionStatus: subscriptions.status,
            currentPeriodStart: subscriptions.currentPeriodStart,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
          })
          .from(subscriptions)
          .leftJoin(plans, eq(plans.id, subscriptions.planId))
          .where(
            and(
              eq(subscriptions.userId, user.id),
              inArray(subscriptions.status, ["active", "trialing", "past_due"])
            )
          )
          .limit(1);
        if (row) subscription = row;
      }
    }

    return c.json({ data: { customer, invoices, subscription } });
  } catch (err) {
    console.error("[customers] GET /:id error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: { code: "INTERNAL_ERROR", message } }, 500);
  }
});

export default app;
