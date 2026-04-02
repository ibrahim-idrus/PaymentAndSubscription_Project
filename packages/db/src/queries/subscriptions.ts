import { and, desc, eq, inArray } from "drizzle-orm";
import { subscriptions } from "../schema";
import type { Db } from "../index";

export type Subscription = typeof subscriptions.$inferSelect;

// Query helpers untuk tabel `subscriptions`.
// Dipakai oleh api-gateway (create/upgrade/cancel) dan subscription-worker (aktivasi setelah paid).

// Buat subscription baru
export async function createSubscription(
  db: Db,
  data: {
    userId: string;
    planId: string;
    status: "trialing" | "active" | "past_due" | "cancelled" | "suspended" | "expired";
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialStart?: string;
    trialEnd?: string;
    renewsAt?: string;
    previousPlanId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<Subscription> {
  const [sub] = await db.insert(subscriptions).values(data).returning();
  return sub;
}

// Ambil subscription by id
export async function getSubscriptionById(
  db: Db,
  id: string
): Promise<Subscription | null> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id));
  return sub ?? null;
}

// Ambil subscription aktif user (active/trialing/past_due)
export async function getActiveSubscriptionByUserId(
  db: Db,
  userId: string
): Promise<Subscription | null> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ["active", "trialing", "past_due"])
      )
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  return sub ?? null;
}

// Update subscription fields (partial)
export async function updateSubscription(
  db: Db,
  id: string,
  data: Partial<typeof subscriptions.$inferInsert>
): Promise<void> {
  await db
    .update(subscriptions)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(subscriptions.id, id));
}
