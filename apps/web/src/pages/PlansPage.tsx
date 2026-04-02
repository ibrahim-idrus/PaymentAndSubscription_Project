import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  billingCycle: "monthly" | "yearly";
  trialDays: number;
  isActive: boolean;
  metadata: unknown;
}

const faqs = [
  {
    q: "Can I cancel anytime?",
    a: "Yes, you can cancel your subscription at any time from your dashboard settings. Your access will remain active until the end of your current billing period.",
  },
  {
    q: "What payment methods are supported?",
    a: "We support all major Indonesian banks via Virtual Accounts, QRIS, Credit Cards (Visa/Mastercard), and E-wallets like GoPay, OVO, and Dana.",
  },
  {
    q: "Is there a setup fee?",
    a: "Absolutely not. There are no hidden costs or setup fees. You only pay for the subscription tier you choose.",
  },
  {
    q: "How does the trial work?",
    a: "Your trial starts the moment you sign up. We won't charge your card until the trial period ends. We'll send you a reminder email 3 days before your trial expires.",
  },
];

function formatPrice(price: string, currency: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(Number(price));
}

export function PlansPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const navigate = useNavigate();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  // Subscribe modal state
  const [modalPlan, setModalPlan] = useState<Plan | null>(null);
  const [userId, setUserId] = useState(() => localStorage.getItem("payflow_user_id") ?? "");
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/plans`)
      .then((r) => r.json())
      .then((body: { data?: Plan[]; error?: { message: string } }) => {
        if (body.error) throw new Error(body.error.message);
        setPlans(body.data ?? []);
      })
      .catch((e) => setPlansError(e.message))
      .finally(() => setLoadingPlans(false));
  }, []);

  const visiblePlans = plans.filter((p) => p.billingCycle === billing);

  async function handleSubscribe() {
    if (!modalPlan) return;
    const uid = userId.trim();
    if (!uid) {
      setSubscribeError("Please enter your User ID.");
      return;
    }
    setSubscribing(true);
    setSubscribeError(null);
    try {
      const res = await fetch(`${API_BASE}/api/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, planId: modalPlan.id }),
      });
      const data = await res.json() as {
        data?: { subscription: { id: string }; orderId: string | null };
        error?: { message: string };
      };
      if (!res.ok) throw new Error(data.error?.message ?? "Subscribe failed");

      localStorage.setItem("payflow_user_id", uid);
      setModalPlan(null);

      if (data.data?.orderId) {
        navigate(`/payment/status/${data.data.orderId}`);
      } else {
        navigate("/subscription");
      }
    } catch (e) {
      setSubscribeError(e instanceof Error ? e.message : "Subscribe failed");
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <div className="bg-surface text-on-surface min-h-dvh">
      <Header />

      <main className="pt-32 pb-32 md:pb-24 px-6 max-w-7xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-16 space-y-4">
          <h1 className="text-4xl md:text-6xl font-extrabold font-headline tracking-tight text-on-surface leading-tight">
            Simple, transparent <br className="hidden md:block" /> pricing for
            growth.
          </h1>
          <p className="text-on-surface-variant max-w-2xl mx-auto text-lg leading-relaxed">
            Choose the ledger plan that scales with your business. All plans
            include our core secure payment infrastructure.
          </p>

          {/* Billing toggle */}
          <div className="flex flex-col items-center gap-4 mt-12">
            <div className="inline-flex items-center p-1 bg-surface-container-high rounded-full">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                  billing === "monthly"
                    ? "bg-white shadow-sm text-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                  billing === "yearly"
                    ? "bg-white shadow-sm text-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Yearly
              </button>
            </div>
            {billing === "yearly" && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-green-100/50 border border-green-200/50 rounded-full">
                <span className="text-xs font-bold text-primary tracking-wide uppercase">
                  Save 2 months
                </span>
                <span
                  className="material-symbols-outlined text-primary text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  auto_awesome
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Plan Cards */}
        {loadingPlans ? (
          <div className="flex items-center justify-center py-20 gap-3 text-on-surface-variant">
            <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Loading plans…</span>
          </div>
        ) : plansError ? (
          <div className="flex items-center justify-center py-20 text-red-600 gap-2">
            <span className="material-symbols-outlined">error</span>
            <span className="text-sm">{plansError}</span>
          </div>
        ) : visiblePlans.length === 0 ? (
          <div className="text-center py-20 text-on-surface-variant text-sm">
            No {billing} plans available.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
            {visiblePlans.map((plan, idx) => {
              const featured = idx === 1 || (visiblePlans.length === 1);
              return (
                <div
                  key={plan.id}
                  className={`group relative bg-surface-container-lowest rounded-3xl p-8 flex flex-col transition-all overflow-hidden ${
                    featured
                      ? "ring-2 ring-primary shadow-2xl shadow-primary/10 scale-105 z-10"
                      : "border border-transparent hover:bg-white hover:shadow-xl hover:shadow-zinc-200/50"
                  }`}
                >
                  {featured && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-primary text-white text-[10px] font-black uppercase tracking-widest py-2 px-10 rotate-45 translate-x-10 translate-y-2">
                        Most Popular
                      </div>
                    </div>
                  )}
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-2">
                      <h3
                        className={`text-lg font-bold ${featured ? "text-primary" : "text-on-surface-variant"}`}
                      >
                        {plan.name}
                      </h3>
                      {featured && (
                        <span
                          className="material-symbols-outlined text-primary text-lg"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          verified
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold font-mono text-on-surface">
                        {formatPrice(plan.price, plan.currency)}
                      </span>
                      <span className="text-on-surface-variant text-sm">/mo</span>
                    </div>
                    {plan.trialDays > 0 && (
                      <p className="mt-4 text-sm text-on-secondary-container bg-secondary-container/30 inline-block px-3 py-1 rounded-lg font-medium">
                        {plan.trialDays}-day free trial
                      </p>
                    )}
                    {plan.description && (
                      <p className="mt-3 text-sm text-on-surface-variant leading-relaxed">
                        {plan.description}
                      </p>
                    )}
                  </div>

                  <div className="flex-grow" />

                  <button
                    onClick={() => {
                      setModalPlan(plan);
                      setSubscribeError(null);
                    }}
                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all active:scale-95 duration-200 ${
                      featured
                        ? "bg-gradient-to-b from-primary to-primary-container text-white shadow-lg shadow-primary/20 hover:brightness-110"
                        : "bg-surface-container-highest text-on-surface hover:bg-surface-dim"
                    }`}
                  >
                    {plan.trialDays > 0 ? "Start Free Trial" : "Subscribe Now"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* FAQ */}
        <section className="mt-32 max-w-3xl mx-auto">
          <h2 className="text-3xl font-extrabold font-headline text-on-surface text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-surface-container-low rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-surface-container transition-colors"
                >
                  <span className="font-bold text-on-surface">{faq.q}</span>
                  <span
                    className="material-symbols-outlined text-on-surface-variant transition-transform duration-200"
                    style={openFaq === i ? { transform: "rotate(180deg)" } : undefined}
                  >
                    expand_more
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-on-surface-variant text-sm leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-high py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-green-600">
              account_balance_wallet
            </span>
            <span className="text-lg font-black text-on-surface font-manrope tracking-tight">
              PayFlow
            </span>
          </div>
          <p className="text-on-surface-variant text-sm font-mono uppercase tracking-widest">
            © 2026 Digital Mint Ledgers Inc.
          </p>
          <div className="flex gap-6">
            {["Privacy", "Terms"].map((l) => (
              <a
                key={l}
                href="#"
                className="text-on-surface-variant hover:text-primary transition-colors text-xs font-bold uppercase tracking-widest"
              >
                {l}
              </a>
            ))}
          </div>
        </div>
      </footer>

      <BottomNav />

      {/* Subscribe Modal */}
      {modalPlan && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalPlan(null); }}
        >
          <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl space-y-5">
            <div>
              <h3 className="text-xl font-bold text-on-surface mb-1">Subscribe to {modalPlan.name}</h3>
              <p className="text-sm text-on-surface-variant">
                {formatPrice(modalPlan.price, modalPlan.currency)}/{modalPlan.billingCycle}
                {modalPlan.trialDays > 0 && ` · ${modalPlan.trialDays}-day free trial`}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Your User ID
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition"
              />
              <p className="text-xs text-on-surface-variant">
                Don't have one?{" "}
                <button
                  className="text-primary underline"
                  onClick={() => { setModalPlan(null); navigate("/checkout"); }}
                >
                  Create via checkout first
                </button>
              </p>
            </div>

            {subscribeError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                <span className="material-symbols-outlined text-base mt-0.5">error</span>
                {subscribeError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setModalPlan(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-on-surface-variant hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                className="flex-1 py-3 rounded-xl bg-[#16A34A] hover:bg-[#15803d] text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {subscribing ? "Processing…" : modalPlan.trialDays > 0 ? "Start Trial" : "Subscribe"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
