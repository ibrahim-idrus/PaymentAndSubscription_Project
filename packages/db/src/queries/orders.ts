import { desc, eq } from "drizzle-orm";
import { orders, webhookEvents, auditLogs } from "../schema";
import type { Db } from "../index";

export type Order = typeof orders.$inferSelect;

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getOrderById(db: Db, id: string): Promise<Order | null> {
  return (await db.query.orders.findFirst({ where: eq(orders.id, id) })) ?? null;
}

export async function getOrdersByUserId(
  db: Db,
  userId: string,
  limit = 10
): Promise<Order[]> {
  return db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function getOrderByXenditInvoiceId(
  db: Db,
  xenditInvoiceId: string
): Promise<Order | null> {
  return (
    (await db.query.orders.findFirst({
      where: eq(orders.xenditInvoiceId, xenditInvoiceId),
    })) ?? null
  );
}

// ─── Write ───────────────────────────────────────────────────────────────────

export async function updateOrderStatus(
  db: Db,
  orderId: string,
  status: "paid" | "expired" | "failed",
  paidAt?: string
): Promise<void> {
  await db
    .update(orders)
    .set({
      status,
      ...(paidAt ? { paidAt } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, orderId));
}

export async function insertWebhookEvent(
  db: Db,
  data: {
    id: string;
    type: "invoice.paid" | "invoice.expired" | "invoice.payment_failed";
    xenditInvoiceId: string;
    payload: unknown;
  }
): Promise<void> {
  await db.insert(webhookEvents).values({
    id: data.id,
    type: data.type,
    xenditInvoiceId: data.xenditInvoiceId,
    payload: data.payload,
  });
}

export async function insertAuditLog(
  db: Db,
  data: {
    entityType: "order" | "subscription" | "user" | "webhook_event";
    entityId: string;
    action: "status_changed" | "created" | "updated" | "deleted" | "renewed" | "cancelled";
    oldStatus: string;
    newStatus: string;
    source: string;
    webhookEventId?: string;
  }
): Promise<void> {
  await db.insert(auditLogs).values({
    entityType: data.entityType,
    entityId: data.entityId,
    action: data.action,
    oldStatus: data.oldStatus,
    newStatus: data.newStatus,
    source: data.source,
    webhookEventId: data.webhookEventId,
  });
}
