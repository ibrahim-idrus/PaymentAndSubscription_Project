import { useState } from "react";
import { useNavigate } from "react-router";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: { monthly: "IDR 99,000", yearly: "IDR 79,000" },
    trial: "14-day trial",
    featured: false,
    features: [
      "Up to 100 transactions/month",
      "QRIS & Virtual Account",
      "Email receipts",
      "Basic analytics",
    ],
    cta: "Get Started",
  },
  {
    id: "pro",
    name: "Pro",
    price: { monthly: "IDR 299,000", yearly: "IDR 249,000" },
    trial: "7-day trial",
    featured: true,
    features: [
      "Unlimited transactions",
      "All payment methods",
      "PDF receipts stored 1 year",
      "Full analytics dashboard",
      "Priority support",
      "Custom domain",
    ],
    cta: "Subscribe Now",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: { monthly: "Custom", yearly: "Custom" },
    trial: null,
    featured: false,
    features: [],
    cta: "Contact Sales",
  },
];

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

export function PlansPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const navigate = useNavigate();

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

          {/* Toggle */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
          {plans.map((plan) =>
            plan.id === "enterprise" ? (
              <div
                key={plan.id}
                className="group relative bg-surface-container-high/50 rounded-3xl p-8 flex flex-col border border-dashed border-zinc-300"
              >
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-on-surface-variant mb-2">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-on-surface">
                      Custom
                    </span>
                  </div>
                  <p className="mt-4 text-sm text-on-surface-variant">
                    Tailored for large organizations with complex billing needs.
                  </p>
                </div>
                <div className="flex-grow space-y-6">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-primary text-3xl">
                      corporate_fare
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-on-surface-variant">
                    Includes dedicated account manager, custom API integrations,
                    and SLA-backed uptime.
                  </p>
                </div>
                <button className="w-full py-4 mt-8 rounded-xl bg-white border border-zinc-200 text-on-surface font-bold text-sm hover:bg-zinc-50 transition-colors">
                  Contact Sales
                </button>
              </div>
            ) : (
              <div
                key={plan.id}
                className={`group relative bg-surface-container-lowest rounded-3xl p-8 flex flex-col transition-all overflow-hidden ${
                  plan.featured
                    ? "ring-2 ring-primary shadow-2xl shadow-primary/10 scale-105 z-10"
                    : "border border-transparent hover:bg-white hover:shadow-xl hover:shadow-zinc-200/50"
                }`}
              >
                {plan.featured && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-primary text-white text-[10px] font-black uppercase tracking-widest py-2 px-10 rotate-45 translate-x-10 translate-y-2">
                      Most Popular
                    </div>
                  </div>
                )}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-2">
                    <h3
                      className={`text-lg font-bold ${plan.featured ? "text-primary" : "text-on-surface-variant"}`}
                    >
                      {plan.name}
                    </h3>
                    {plan.featured && (
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
                      {plan.price[billing]}
                    </span>
                    <span className="text-on-surface-variant text-sm">/mo</span>
                  </div>
                  {plan.trial && (
                    <p className="mt-4 text-sm text-on-secondary-container bg-secondary-container/30 inline-block px-3 py-1 rounded-lg font-medium">
                      {plan.trial}
                    </p>
                  )}
                </div>
                <ul className="space-y-4 flex-grow mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span
                        className="material-symbols-outlined text-primary text-xl"
                        style={
                          plan.featured
                            ? { fontVariationSettings: "'FILL' 1" }
                            : undefined
                        }
                      >
                        check_circle
                      </span>
                      <span
                        className={`text-sm ${plan.featured ? "text-on-surface font-medium" : "text-on-surface-variant"}`}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate("/checkout")}
                  className={`w-full py-4 rounded-xl font-bold text-sm transition-all active:scale-95 duration-200 ${
                    plan.featured
                      ? "bg-gradient-to-b from-primary to-primary-container text-white shadow-lg shadow-primary/20 hover:brightness-110"
                      : "bg-surface-container-highest text-on-surface hover:bg-surface-dim"
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            )
          )}
        </div>

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
                    style={
                      openFaq === i ? { transform: "rotate(180deg)" } : undefined
                    }
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
    </div>
  );
}
