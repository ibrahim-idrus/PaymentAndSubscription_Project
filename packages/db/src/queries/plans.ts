import { eq } from "drizzle-orm";
import { plans } from "../schema";
import type { Db } from "../index";

export type Plan = typeof plans.$inferSelect;

// Query helpers untuk tabel `plans` (subscription plan management).

// List plan yang aktif (isActive = true)
export async function getAllActivePlans(db: Db): Promise<Plan[]> {
  return db.select().from(plans).where(eq(plans.isActive, true));
}

// Ambil 1 plan berdasarkan id
export async function getPlanById(db: Db, id: string): Promise<Plan | null> {
  const [plan] = await db.select().from(plans).where(eq(plans.id, id));
  return plan ?? null;
}

// Buat plan baru (admin)
export async function createPlan(
  db: Db,
  data: {
    name: string;
    description?: string;
    price: string;
    currency?: string;
    billingCycle: "monthly" | "yearly";
    trialDays?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<Plan> {
  const [plan] = await db
    .insert(plans)
    .values({
      name: data.name,
      description: data.description,
      price: data.price,
      currency: data.currency ?? "IDR",
      billingCycle: data.billingCycle,
      trialDays: data.trialDays ?? 0,
      metadata: data.metadata,
    })
    .returning();
  return plan;
}
