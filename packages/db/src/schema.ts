/**
 * schema.ts — Definisi struktur database menggunakan Drizzle ORM.
 *
 * File ini adalah "peta" database kamu dalam bentuk TypeScript.
 * Drizzle membaca file ini untuk:
 *  1. Generate migration SQL (pnpm db:generate)
 *  2. Memberikan type-safety saat menulis query di kode
 *  3. Menampilkan struktur di Drizzle Studio (pnpm db:studio)
 *
 * Setiap `pgTable` = satu tabel di database.
 * Setiap `pgEnum` = satu ENUM type di PostgreSQL.
 * Setiap `pgView` = satu VIEW (query tersimpan, read-only).
 */

import {
  pgTable, pgView, pgEnum,
  index, foreignKey, unique, check,
  uuid, varchar, char, text, numeric, integer, boolean, bigint,
  timestamp, jsonb, inet,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// =============================================================================
// ENUMS — Nilai-nilai yang diperbolehkan untuk kolom tertentu
// =============================================================================

// Jenis aksi yang dicatat di audit log
export const auditAction = pgEnum("audit_action", [
  "created", "updated", "status_changed", "deleted", "renewed", "cancelled",
]);

// Siklus penagihan langganan
export const billingCycle = pgEnum("billing_cycle", ["monthly", "yearly"]);

// Jenis entitas yang bisa di-audit
export const entityType = pgEnum("entity_type", [
  "order", "subscription", "user", "webhook_event",
]);

// Status pembayaran/order
export const orderStatus = pgEnum("order_status", [
  "pending", "paid", "failed", "expired", "refunded",
]);

// Status langganan pengguna
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing", "active", "past_due", "cancelled", "suspended", "expired",
]);

// Jenis event webhook dari Xendit (payment gateway)
export const webhookEventType = pgEnum("webhook_event_type", [
  "invoice.paid",
  "invoice.expired",
  "invoice.payment_failed",
  "recurring_payment.made",
  "recurring_payment.missed",
  "recurring_payment.failed",
]);

// =============================================================================
// TABEL UTAMA
// =============================================================================

/**
 * plans — Daftar paket langganan yang tersedia.
 * Contoh: "Basic Monthly", "Pro Yearly", dll.
 */
export const plans = pgTable("plans", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: varchar({ length: 100 }).notNull(),
  description: text(),
  price: numeric({ precision: 12, scale: 2 }).notNull(),
  currency: char({ length: 3 }).default("IDR").notNull(),
  billingCycle: billingCycle("billing_cycle").notNull(),
  trialDays: integer("trial_days").default(0).notNull(),     // Jumlah hari trial gratis
  isActive: boolean("is_active").default(true).notNull(),    // false = plan tidak dijual lagi
  metadata: jsonb(),                                          // Data tambahan fleksibel (JSON)
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
  index("idx_plans_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
  index("idx_plans_currency").using("btree", table.currency.asc().nullsLast().op("bpchar_ops")),
  index("idx_plans_metadata").using("gin", table.metadata.asc().nullsLast().op("jsonb_ops")).where(sql`(metadata IS NOT NULL)`),
  check("plans_price_check", sql`price >= (0)::numeric`),
  check("plans_trial_days_check", sql`trial_days >= 0`),
]);

/**
 * users — Data pengguna aplikasi.
 * Menyimpan info profil + status langganan aktif mereka.
 */
export const users = pgTable("users", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  email: varchar({ length: 320 }).notNull(),
  fullName: varchar("full_name", { length: 255 }),
  planId: uuid("plan_id"),                                         // Plan yang sedang dipakai
  subscriptionStatus: subscriptionStatus("subscription_status").default("expired").notNull(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true, mode: "string" }),
  xenditCustomerId: varchar("xendit_customer_id", { length: 255 }), // ID customer di Xendit
  preferredCurrency: char("preferred_currency", { length: 3 }).default("IDR").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
  index("idx_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
  index("idx_users_plan").using("btree", table.planId.asc().nullsLast().op("uuid_ops")),
  index("idx_users_subscription_status").using("btree", table.subscriptionStatus.asc().nullsLast().op("enum_ops")),
  index("idx_users_trial_ends_at").using("btree", table.trialEndsAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(trial_ends_at IS NOT NULL)`),
  foreignKey({
    columns: [table.planId],
    foreignColumns: [plans.id],
    name: "users_plan_id_fkey",
  }).onDelete("set null"),
  unique("users_email_key").on(table.email),
  unique("users_xendit_customer_id_key").on(table.xenditCustomerId),
]);

/**
 * subscriptions — Riwayat langganan pengguna.
 * Satu user bisa punya beberapa record (ganti plan, perpanjang, dll.)
 */
export const subscriptions = pgTable("subscriptions", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: uuid("user_id").notNull(),
  planId: uuid("plan_id").notNull(),
  status: subscriptionStatus().default("trialing").notNull(),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: "string" }).notNull(),
  trialStart: timestamp("trial_start", { withTimezone: true, mode: "string" }),
  trialEnd: timestamp("trial_end", { withTimezone: true, mode: "string" }),
  renewsAt: timestamp("renews_at", { withTimezone: true, mode: "string" }),      // Jadwal perpanjang otomatis
  cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "string" }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),   // true = cancel saat periode habis
  gracePeriodEndsAt: timestamp("grace_period_ends_at", { withTimezone: true, mode: "string" }), // Batas waktu grace period
  previousPlanId: uuid("previous_plan_id"),                                       // Plan sebelumnya (untuk downgrade/upgrade)
  metadata: jsonb(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
  index("idx_subscriptions_grace").using("btree", table.gracePeriodEndsAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(grace_period_ends_at IS NOT NULL)`),
  index("idx_subscriptions_plan").using("btree", table.planId.asc().nullsLast().op("uuid_ops")),
  index("idx_subscriptions_renews_at").using("btree", table.renewsAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(renews_at IS NOT NULL)`),
  index("idx_subscriptions_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
  index("idx_subscriptions_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
  foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "subscriptions_user_id_fkey" }).onDelete("cascade"),
  foreignKey({ columns: [table.planId], foreignColumns: [plans.id], name: "subscriptions_plan_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.previousPlanId], foreignColumns: [plans.id], name: "subscriptions_previous_plan_id_fkey" }).onDelete("set null"),
]);

/**
 * orders — Transaksi pembayaran.
 * Setiap kali user bayar (baru/perpanjang), dibuat satu record order.
 * Terintegrasi dengan Xendit sebagai payment gateway.
 */
export const orders = pgTable("orders", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: uuid("user_id").notNull(),
  subscriptionId: uuid("subscription_id"),
  xenditInvoiceId: varchar("xendit_invoice_id", { length: 255 }),   // ID invoice dari Xendit
  xenditPaymentId: varchar("xendit_payment_id", { length: 255 }),   // ID pembayaran dari Xendit
  idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(), // Mencegah duplikasi order
  amount: numeric({ precision: 12, scale: 2 }).notNull(),
  currency: char({ length: 3 }).default("IDR").notNull(),
  status: orderStatus().default("pending").notNull(),
  paymentMethod: varchar("payment_method", { length: 100 }),
  paymentChannel: varchar("payment_channel", { length: 100 }),
  paymentUrl: text("payment_url"),   // Link halaman pembayaran Xendit
  invoiceUrl: text("invoice_url"),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),
  paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),
  description: text(),
  metadata: jsonb(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
  index("idx_orders_created").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
  index("idx_orders_metadata").using("gin", table.metadata.asc().nullsLast().op("jsonb_ops")).where(sql`(metadata IS NOT NULL)`),
  index("idx_orders_pending").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`(status = 'pending'::order_status)`),
  index("idx_orders_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
  index("idx_orders_subscription").using("btree", table.subscriptionId.asc().nullsLast().op("uuid_ops")).where(sql`(subscription_id IS NOT NULL)`),
  index("idx_orders_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
  index("idx_orders_xendit_invoice").using("btree", table.xenditInvoiceId.asc().nullsLast().op("text_ops")),
  foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "orders_user_id_fkey" }).onDelete("restrict"),
  foreignKey({ columns: [table.subscriptionId], foreignColumns: [subscriptions.id], name: "orders_subscription_id_fkey" }).onDelete("set null"),
  unique("orders_xendit_invoice_id_key").on(table.xenditInvoiceId),
  unique("orders_idempotency_key_key").on(table.idempotencyKey),
  check("orders_amount_check", sql`amount > (0)::numeric`),
]);

/**
 * receipts — Bukti pembayaran (kuitansi) yang disimpan di Cloudflare R2.
 * Satu order memiliki maksimal satu receipt.
 */
export const receipts = pgTable("receipts", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  orderId: uuid("order_id").notNull(),
  r2Bucket: varchar("r2_bucket", { length: 255 }).notNull(),             // Nama bucket di Cloudflare R2
  r2Key: varchar("r2_key", { length: 500 }).notNull(),                   // Path file di dalam bucket
  signedUrl: text("signed_url"),                                          // URL sementara untuk download
  signedUrlExpiresAt: timestamp("signed_url_expires_at", { withTimezone: true, mode: "string" }), // Kapan URL expired
  fileSizeBytes: integer("file_size_bytes"),
  generatedAt: timestamp("generated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  lastUrlRefreshedAt: timestamp("last_url_refreshed_at", { withTimezone: true, mode: "string" }),
}, (table) => [
  index("idx_receipts_expires").using("btree", table.signedUrlExpiresAt.asc().nullsLast().op("timestamptz_ops")),
  index("idx_receipts_order").using("btree", table.orderId.asc().nullsLast().op("uuid_ops")),
  foreignKey({ columns: [table.orderId], foreignColumns: [orders.id], name: "receipts_order_id_fkey" }).onDelete("cascade"),
  unique("receipts_order_id_key").on(table.orderId),
  unique("receipts_r2_key_key").on(table.r2Key),
]);

/**
 * webhook_events — Log semua event yang diterima dari Xendit.
 * Digunakan untuk idempotency (mencegah proses event yang sama dua kali).
 */
export const webhookEvents = pgTable("webhook_events", {
  id: varchar({ length: 255 }).primaryKey().notNull(), // Pakai ID dari Xendit langsung
  type: webhookEventType().notNull(),
  xenditInvoiceId: varchar("xendit_invoice_id", { length: 255 }),
  payload: jsonb().notNull(),           // Raw payload dari Xendit
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  processingError: text("processing_error"), // Isi jika gagal diproses
  retryCount: integer("retry_count").default(0).notNull(),
  workerInstance: varchar("worker_instance", { length: 255 }), // ID worker yang memproses
}, (table) => [
  index("idx_webhook_events_invoice").using("btree", table.xenditInvoiceId.asc().nullsLast().op("text_ops")),
  index("idx_webhook_events_processed_at").using("btree", table.processedAt.desc().nullsFirst().op("timestamptz_ops")),
  index("idx_webhook_events_type").using("btree", table.type.asc().nullsLast().op("enum_ops")),
]);

/**
 * audit_logs — Catatan perubahan penting di sistem.
 * Merekam siapa mengubah apa, kapan, dan dari/ke status apa.
 */
export const auditLogs = pgTable("audit_logs", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  entityType: entityType("entity_type").notNull(),   // Jenis data yang berubah
  entityId: uuid("entity_id").notNull(),             // ID data yang berubah
  action: auditAction().notNull(),
  oldStatus: varchar("old_status", { length: 100 }), // Status sebelum perubahan
  newStatus: varchar("new_status", { length: 100 }), // Status setelah perubahan
  oldData: jsonb("old_data"),                         // Snapshot data sebelumnya
  newData: jsonb("new_data"),                         // Snapshot data baru
  source: varchar({ length: 100 }),                   // Asal perubahan (webhook, admin, system)
  actorId: uuid("actor_id"),                          // User yang melakukan perubahan (jika ada)
  webhookEventId: varchar("webhook_event_id", { length: 255 }),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
  index("idx_audit_logs_actor").using("btree", table.actorId.asc().nullsLast().op("uuid_ops")).where(sql`(actor_id IS NOT NULL)`),
  index("idx_audit_logs_created").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
  index("idx_audit_logs_entity").using("btree", table.entityType.asc().nullsLast().op("enum_ops"), table.entityId.asc().nullsLast().op("uuid_ops")),
  index("idx_audit_logs_source").using("btree", table.source.asc().nullsLast().op("text_ops")),
  foreignKey({ columns: [table.webhookEventId], foreignColumns: [webhookEvents.id], name: "audit_logs_webhook_event_id_fkey" }).onDelete("set null"),
]);

/**
 * api_keys — Kunci API untuk akses programmatic ke sistem.
 * Key asli tidak disimpan, hanya hash-nya (seperti password).
 */
export const apiKeys = pgTable("api_keys", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull(),
  keyHash: char("key_hash", { length: 64 }).notNull(),   // SHA-256 hash dari API key
  keyPrefix: char("key_prefix", { length: 8 }).notNull(), // Prefix untuk identifikasi (misal: "sk_live_")
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "string" }),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => [
  index("idx_api_keys_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
  index("idx_api_keys_active_only").using("btree", table.keyHash.asc().nullsLast().op("bpchar_ops")).where(sql`(is_active = true)`),
  index("idx_api_keys_hash").using("btree", table.keyHash.asc().nullsLast().op("bpchar_ops")),
  foreignKey({ columns: [table.createdBy], foreignColumns: [users.id], name: "api_keys_created_by_fkey" }).onDelete("set null"),
  unique("api_keys_key_hash_key").on(table.keyHash),
]);

// =============================================================================
// VIEWS — Query tersimpan di database, read-only, tidak bisa di-INSERT/UPDATE
// =============================================================================

/**
 * v_active_subscriptions — Langganan yang sedang aktif/trial/past_due.
 * Join dari subscriptions + users + plans untuk tampilan lengkap.
 */
export const vActiveSubscriptions = pgView("v_active_subscriptions", {
  subscriptionId: uuid("subscription_id"),
  userId: uuid("user_id"),
  email: varchar({ length: 320 }),
  fullName: varchar("full_name", { length: 255 }),
  planName: varchar("plan_name", { length: 100 }),
  price: numeric({ precision: 12, scale: 2 }),
  currency: char({ length: 3 }),
  billingCycle: billingCycle("billing_cycle"),
  status: subscriptionStatus(),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: "string" }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: "string" }),
  renewsAt: timestamp("renews_at", { withTimezone: true, mode: "string" }),
  trialEnd: timestamp("trial_end", { withTimezone: true, mode: "string" }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end"),
  gracePeriodEndsAt: timestamp("grace_period_ends_at", { withTimezone: true, mode: "string" }),
}).as(sql`
  SELECT s.id AS subscription_id, s.user_id, u.email, u.full_name,
    p.name AS plan_name, p.price, p.currency, p.billing_cycle,
    s.status, s.current_period_start, s.current_period_end,
    s.renews_at, s.trial_end, s.cancel_at_period_end, s.grace_period_ends_at
  FROM subscriptions s
  JOIN users u ON u.id = s.user_id
  JOIN plans p ON p.id = s.plan_id
  WHERE s.status = ANY (ARRAY['active'::subscription_status, 'trialing'::subscription_status, 'past_due'::subscription_status])
`);

/**
 * v_renewals_due — Langganan yang jadwal perpanjangnya dalam 24 jam ke depan.
 * Dipakai oleh worker/cron job untuk trigger penagihan otomatis.
 */
export const vRenewalsDue = pgView("v_renewals_due", {
  subscriptionId: uuid("subscription_id"),
  userId: uuid("user_id"),
  email: varchar({ length: 320 }),
  price: numeric({ precision: 12, scale: 2 }),
  currency: char({ length: 3 }),
  billingCycle: billingCycle("billing_cycle"),
  renewsAt: timestamp("renews_at", { withTimezone: true, mode: "string" }),
}).as(sql`
  SELECT s.id AS subscription_id, s.user_id, u.email, p.price, p.currency, p.billing_cycle, s.renews_at
  FROM subscriptions s
  JOIN users u ON u.id = s.user_id
  JOIN plans p ON p.id = s.plan_id
  WHERE s.status = 'active'::subscription_status
    AND s.cancel_at_period_end = false
    AND s.renews_at >= now()
    AND s.renews_at <= (now() + '24:00:00'::interval)
`);

/**
 * v_user_payment_summary — Ringkasan riwayat pembayaran per user.
 * Berguna untuk dashboard admin: total transaksi, total dibayar, gagal bayar.
 */
export const vUserPaymentSummary = pgView("v_user_payment_summary", {
  userId: uuid("user_id"),
  email: varchar({ length: 320 }),
  totalOrders: bigint("total_orders", { mode: "number" }),
  totalPaid: numeric("total_paid"),
  lastPaymentAt: timestamp("last_payment_at", { withTimezone: true, mode: "string" }),
  failedPayments: bigint("failed_payments", { mode: "number" }),
}).as(sql`
  SELECT u.id AS user_id, u.email,
    count(o.id) AS total_orders,
    sum(CASE WHEN o.status = 'paid'::order_status THEN o.amount ELSE 0::numeric END) AS total_paid,
    max(o.paid_at) AS last_payment_at,
    count(CASE WHEN o.status = 'failed'::order_status THEN 1 ELSE NULL::integer END) AS failed_payments
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
  GROUP BY u.id, u.email
`);
