// ─── Plans & Statuses ────────────────────────────────────────────────────────

export type Plan = "free" | "pro" | "enterprise";

export type SubscriptionStatus = "active" | "cancelled" | "past_due" | "trialing";

export type PaymentStatus = "succeeded" | "failed" | "pending" | "refunded";

// ─── Domain Entities ─────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: Plan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
}

export interface Payment {
  id: string;
  userId: string;
  subscriptionId: string | null;
  amount: number; // in cents
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
}

// ─── API Response Shapes ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error?: never;
}

export interface ApiError {
  data?: never;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;
