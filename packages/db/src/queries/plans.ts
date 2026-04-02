import { eq } from "drizzle-orm";
import { plans } from "../schema";
import type { Db } from "../index";

export type Plan = typeof plans.$inferSelect;

export async function getAllActivePlans(db: Db): Promise<Plan[]> {
  return db.select().from(plans).where(eq(plans.isActive, true));
}

export async function getPlanById(db: Db, id: string): Promise<Plan | null> {
  const [plan] = await db.select().from(plans).where(eq(plans.id, id));
  return plan ?? null;
}

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
