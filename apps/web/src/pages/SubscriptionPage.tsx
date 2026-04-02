import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";

// Base URL backend (api-gateway). Endpoint yang dipakai:
// - GET /api/subscriptions/user/:userId (load subscription + plan + billing history)
// - POST /api/subscriptions/:id/cancel (schedule cancellation)
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

interface Plan {
  id: string;
  name: string;
  price: string;
  currency: string;
  billingCycle: "monthly" | "yearly";
}

interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  trialEnd: string | null;
}

interface Order {
  id: string;
  amount: string;
  currency: string;
  status: string;
  description: string | null;
  paidAt: string | null;
  createdAt: string;
}

const sidebarLinks = [
  { to: "/", icon: "dashboard", label: "Dashboard" },
  { to: "/subscription", icon: "subscriptions", label: "Subscriptions" },
  { to: "/plans", icon: "sell", label: "Plans" },
  { to: "/settings", icon: "settings", label: "Settings" },
];

function formatIDR(amount: string, currency: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(Number(amount));
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(iso));
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-600",
  suspended: "bg-gray-100 text-gray-500",
  expired: "bg-gray-100 text-gray-400",
};

const ORDER_STATUS_BADGE: Record<string, string> = {
  paid: "bg-secondary/10 text-secondary",
  pending: "bg-amber-100 text-amber-600",
  failed: "bg-red-100 text-red-600",
  expired: "bg-gray-100 text-gray-400",
};

export function SubscriptionPage() {
  const navigate = useNavigate();

  // UserId disimpan di localStorage dari flow subscribe (PlansPage) / input manual
  const [userId, setUserId] = useState(() => localStorage.getItem("payflow_user_id") ?? "");
  const [inputId, setInputId] = useState(userId);

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [billingHistory, setBillingHistory] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function fetchSubscription(uid: string) {
    setLoading(true);
    setError(null);
    try {
      // Backend mengembalikan: subscription aktif + plan + billingHistory (orders)
      const res = await fetch(`${API_BASE}/api/subscriptions/user/${uid}`);
      const data = await res.json() as {
        data: { subscription: Subscription; plan: Plan } | null;
        billingHistory: Order[];
        error?: { message: string };
      };
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to load subscription");
      setSubscription(data.data?.subscription ?? null);
      setPlan(data.data?.plan ?? null);
      setBillingHistory(data.billingHistory ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setSubscription(null);
      setPlan(null);
      setBillingHistory([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userId) fetchSubscription(userId);
  }, [userId]);

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const uid = inputId.trim();
    if (!uid) return;
    // Simpan supaya halaman lain (PlansPage) bisa reuse userId
    localStorage.setItem("payflow_user_id", uid);
    setUserId(uid);
  }

  async function handleCancel() {
    if (!subscription) return;
    setCancelling(true);
    setCancelError(null);
    try {
      // Cancel subscription = schedule cancelAtPeriodEnd di backend
      const res = await fetch(`${API_BASE}/api/subscriptions/${subscription.id}/cancel`, {
        method: "POST",
      });
      const data = await res.json() as { error?: { message: string } };
      if (!res.ok) throw new Error(data.error?.message ?? "Cancel failed");
      await fetchSubscription(userId);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="bg-surface text-on-surface min-h-dvh">
      <Header />

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-16 py-8 px-4 border-r border-zinc-200 h-[calc(100vh-4rem)] w-64 hidden md:flex flex-col bg-surface-container-low">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
            <span className="material-symbols-outlined text-on-surface-variant">person</span>
          </div>
          <div>
            <p className="font-manrope text-sm font-bold text-on-surface">
              {userId ? userId.slice(0, 8) + "…" : "No user"}
            </p>
            <p className="text-[10px] text-on-surface-variant">
              {subscription ? `${plan?.name ?? "—"} Plan` : "No active plan"}
            </p>
          </div>
        </div>
        <nav className="space-y-1">
          {sidebarLinks.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-300 ${
                  isActive
                    ? "bg-white text-primary font-bold shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`
              }
            >
              <span className="material-symbols-outlined">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="pt-24 pb-32 md:pb-12 px-6 md:ml-64 max-w-5xl mx-auto">
        {/* Header */}
        <section className="mb-10">
          <h1 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight mb-2">
            Subscription Settings
          </h1>
          <p className="text-on-surface-variant text-sm max-w-lg leading-relaxed">
            Manage your premium features, billing cycle, and payment history.
          </p>
        </section>

        {/* User ID lookup */}
        <form onSubmit={handleLookup} className="flex gap-2 mb-8 max-w-lg">
          <input
            type="text"
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            placeholder="Enter your User ID (UUID)"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition"
          />
          <button
            type="submit"
            className="bg-[#16A34A] hover:bg-[#15803d] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all active:scale-95 whitespace-nowrap"
          >
            Load
          </button>
        </form>

        {loading && (
          <div className="flex items-center gap-3 py-12 text-on-surface-variant">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Loading subscription…</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
            <span className="material-symbols-outlined text-base mt-0.5">error</span>
            {error}
          </div>
        )}

        {!loading && userId && !error && !subscription && (
          <div className="text-center py-20 space-y-4">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant">
              subscriptions
            </span>
            <p className="text-on-surface-variant text-sm">No active subscription found.</p>
            <button
              onClick={() => navigate("/plans")}
              className="bg-[#16A34A] hover:bg-[#15803d] text-white font-bold px-6 py-3 rounded-xl text-sm transition-all"
            >
              Browse Plans
            </button>
          </div>
        )}

        {subscription && plan && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Current Plan Card */}
            <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-8 shadow-[0_24px_48px_-12px_rgba(17,24,39,0.06)] flex flex-col justify-between border-b-4 border-primary">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 block">
                      Active Membership
                    </span>
                    <h2 className="text-2xl font-headline font-bold text-on-surface">
                      {plan.name}
                    </h2>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      STATUS_BADGE[subscription.status] ?? "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {subscription.status === "active" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                    )}
                    {subscription.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <p className="text-xs text-on-surface-variant mb-1 capitalize">
                      {plan.billingCycle} Billing
                    </p>
                    <p className="font-mono text-xl font-semibold">
                      {formatIDR(plan.price, plan.currency)}{" "}
                      <span className="text-sm font-normal text-on-surface-variant font-body">
                        / {plan.billingCycle === "monthly" ? "month" : "year"}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-on-surface-variant mb-1">
                      {subscription.cancelAtPeriodEnd ? "Access Until" : "Next Renewal"}
                    </p>
                    <p className="font-mono text-xl font-semibold">
                      {formatDate(subscription.currentPeriodEnd)}
                    </p>
                  </div>
                </div>

                {subscription.cancelAtPeriodEnd && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3 mb-4">
                    <span className="material-symbols-outlined text-base">info</span>
                    Subscription will end on {formatDate(subscription.currentPeriodEnd)}.
                  </div>
                )}

                {subscription.status === "trialing" && subscription.trialEnd && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-xl px-4 py-3 mb-4">
                    <span className="material-symbols-outlined text-base">schedule</span>
                    Trial ends on {formatDate(subscription.trialEnd)}.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4 pt-6 border-t border-surface-container">
                <button
                  onClick={() => navigate("/plans")}
                  className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">swap_horiz</span>
                  Change Plan
                </button>
                {!subscription.cancelAtPeriodEnd && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="text-error text-sm font-semibold hover:bg-error/5 px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {cancelling ? "Cancelling…" : "Cancel Subscription"}
                  </button>
                )}
              </div>

              {cancelError && (
                <p className="mt-3 text-sm text-red-600">{cancelError}</p>
              )}
            </div>

            {/* Info Card */}
            <div className="lg:col-span-4 bg-surface-container-low rounded-xl p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-headline font-bold mb-6">Subscription Details</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-on-surface-variant mb-1">Subscription ID</p>
                    <p className="font-mono text-xs text-on-surface break-all">{subscription.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-on-surface-variant mb-1">Period Start</p>
                    <p className="font-mono text-sm">{formatDate(subscription.currentPeriodStart)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-on-surface-variant mb-1">Period End</p>
                    <p className="font-mono text-sm">{formatDate(subscription.currentPeriodEnd)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Billing History */}
            {billingHistory.length > 0 && (
              <div className="lg:col-span-12 mt-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-headline font-bold">Billing History</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-separate border-spacing-y-3">
                    <thead className="hidden md:table-header-group">
                      <tr className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        <th className="pb-2 px-4">Date</th>
                        <th className="pb-2 px-4">Description</th>
                        <th className="pb-2 px-4 text-right">Amount</th>
                        <th className="pb-2 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingHistory.map((row) => (
                        <tr
                          key={row.id}
                          className="bg-surface-container-lowest md:hover:bg-surface-container-low transition-colors rounded-xl md:table-row flex flex-col p-4 md:p-0 mb-4 md:mb-0"
                        >
                          <td className="px-4 py-4 md:py-5 font-mono text-sm md:table-cell flex justify-between">
                            <span className="md:hidden text-[10px] font-bold text-on-surface-variant uppercase">Date</span>
                            {formatDate(row.paidAt ?? row.createdAt)}
                          </td>
                          <td className="px-4 py-2 md:py-5 md:table-cell flex justify-between">
                            <span className="md:hidden text-[10px] font-bold text-on-surface-variant uppercase">Plan</span>
                            <span className="font-medium">{row.description ?? "Payment"}</span>
                          </td>
                          <td className="px-4 py-2 md:py-5 text-right font-mono font-bold md:table-cell flex justify-between">
                            <span className="md:hidden text-[10px] font-bold text-on-surface-variant uppercase">Amount</span>
                            {formatIDR(row.amount, row.currency)}
                          </td>
                          <td className="px-4 py-2 md:py-5 text-center md:table-cell flex justify-between">
                            <span className="md:hidden text-[10px] font-bold text-on-surface-variant uppercase">Status</span>
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                ORDER_STATUS_BADGE[row.status] ?? "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Danger Zone */}
            {!subscription.cancelAtPeriodEnd && (
              <div className="lg:col-span-12 mt-12 bg-error/5 border-2 border-dashed border-error/20 rounded-xl p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-lg font-headline font-bold text-error mb-1">
                      Cancel Subscription
                    </h3>
                    <p className="text-sm text-on-surface-variant">
                      Terminating your subscription will downgrade your access to the free tier
                      at the end of the current billing cycle.
                    </p>
                  </div>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="border border-error text-error px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-error hover:text-white transition-all whitespace-nowrap self-start md:self-center disabled:opacity-50"
                  >
                    {cancelling ? "Cancelling…" : "Cancel Plan"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
