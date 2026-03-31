import { useState } from "react";
import { useNavigate } from "react-router";
import { Header } from "@/components/layout/Header";

type PaymentMethod = "qris" | "va" | "ewallet" | "card";

const paymentMethods: { id: PaymentMethod; icon: string; label: string }[] = [
  { id: "qris", icon: "qr_code_2", label: "QRIS" },
  { id: "va", icon: "account_balance", label: "Virtual Account" },
  { id: "ewallet", icon: "account_balance_wallet", label: "E-Wallet" },
  { id: "card", icon: "credit_card", label: "Card" },
];

const trustSignals = [
  { icon: "verified_user", label: "256-bit SSL encryption" },
  { icon: "shield_with_heart", label: "Secured by Xendit" },
  { icon: "event_repeat", label: "Cancel anytime" },
];

export function CheckoutPage() {
  const [method, setMethod] = useState<PaymentMethod>("qris");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(true);
    setTimeout(() => navigate("/status"), 2000);
  }

  return (
    <div className="bg-surface text-on-surface min-h-dvh selection:bg-primary-container selection:text-white">
      <Header variant="checkout" />

      <main className="pt-16 pb-24 md:pt-24 max-w-4xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Order Summary */}
          <section className="lg:col-span-5 lg:order-2">
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold font-headline tracking-tight">
                  Order Summary
                </h2>
                <span className="bg-[#DCFCE7] text-[#14532D] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  14-Day Free Trial
                </span>
              </div>

              {/* Product */}
              <div className="flex gap-4 mb-8">
                <div className="w-16 h-16 bg-surface-container-high rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-3xl">
                    workspace_premium
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-on-surface">Pro Plan — Monthly</p>
                  <p className="text-sm text-on-surface-variant">
                    Access to all premium features
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-medium">IDR 299,000</p>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-3 mb-8">
                <div className="flex justify-between text-sm text-on-surface-variant">
                  <span>Pro Plan subscription</span>
                  <span className="font-mono">IDR 299,000</span>
                </div>
                <div className="flex justify-between text-sm text-primary font-medium">
                  <span>14-day free trial</span>
                  <span className="font-mono">— IDR 299,000</span>
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-surface-variant pt-4 space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">
                      Due today
                    </p>
                    <p className="text-3xl font-black font-headline text-primary font-mono">
                      IDR 0
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-on-surface-variant">
                      After trial (Apr 10)
                    </p>
                    <p className="text-sm font-bold font-mono">IDR 299,000/mo</p>
                  </div>
                </div>
              </div>

              {/* Trust Signals */}
              <div className="mt-8 pt-6 border-t border-surface-variant flex flex-col gap-3">
                {trustSignals.map(({ icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 text-[10px] text-on-surface-variant font-medium uppercase tracking-widest"
                  >
                    <span className="material-symbols-outlined text-xs">
                      {icon}
                    </span>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Payment Form */}
          <section className="lg:col-span-7 lg:order-1">
            <div className="mb-10">
              <h1 className="text-3xl font-black font-headline tracking-tight mb-2">
                Complete your order
              </h1>
              <p className="text-on-surface-variant">
                Start your 14-day trial. No charge today.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-10">
              {/* Email */}
              <div className="relative group">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 px-1">
                  Email Address
                </label>
                <input
                  type="email"
                  readOnly
                  defaultValue="user@example.com"
                  className="w-full bg-transparent border-0 border-b border-surface-variant/20 focus:border-primary focus:ring-0 px-1 py-3 transition-all duration-300 font-medium outline-none"
                />
                <div className="absolute right-2 top-9">
                  <span
                    className="material-symbols-outlined text-primary text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                </div>
              </div>

              {/* Payment Method Tabs */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 px-1">
                  Payment Method
                </label>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {paymentMethods.map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setMethod(pm.id)}
                      className={`flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl transition-all active:scale-95 duration-200 ${
                        method === pm.id
                          ? "bg-primary text-white shadow-sm"
                          : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {pm.icon}
                      </span>
                      <span className="text-sm font-bold">{pm.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* QRIS Panel */}
              {method === "qris" && (
                <div className="bg-surface-container-low rounded-2xl p-8 flex flex-col items-center justify-center text-center animate-[fadeIn_0.4s_ease-out_forwards]">
                  <div className="relative group cursor-pointer mb-6">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-2xl blur opacity-10 group-hover:opacity-20 transition duration-1000" />
                    <div className="relative w-52 h-52 bg-white rounded-xl shadow-inner flex items-center justify-center p-4">
                      <span className="material-symbols-outlined text-8xl text-surface-container-high">
                        qr_code_2
                      </span>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm border border-surface-variant/20">
                          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                            Code appears on confirm
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-on-surface mb-2">
                    Scan with GoPay, OVO, Dana, ShopeePay, etc.
                  </p>
                  <p className="text-xs text-on-surface-variant max-w-[240px]">
                    A unique QRIS code will be generated once you click the
                    button below.
                  </p>
                </div>
              )}

              {/* Other method placeholder */}
              {method !== "qris" && (
                <div className="bg-surface-container-low rounded-2xl p-8 text-center">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant">
                    {paymentMethods.find((p) => p.id === method)?.icon}
                  </span>
                  <p className="mt-4 text-sm text-on-surface-variant">
                    {method === "va" && "Select your bank to get a virtual account number."}
                    {method === "ewallet" && "Select your e-wallet to continue."}
                    {method === "card" && "Enter your card details to proceed."}
                  </p>
                </div>
              )}

              {/* CTA */}
              <div className="space-y-6">
                <button
                  type="submit"
                  className="w-full bg-gradient-to-b from-[#16A34A] to-[#00873a] text-white py-5 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl active:scale-[0.98] transition-all duration-300"
                >
                  Start Free Trial
                </button>
                <p className="text-center text-xs text-on-surface-variant leading-relaxed px-4">
                  By continuing you agree to our{" "}
                  <a href="#" className="text-primary font-bold hover:underline">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-primary font-bold hover:underline">
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </form>
          </section>
        </div>
      </main>

      {/* Success Overlay */}
      {success && (
        <div className="fixed inset-0 z-[100] bg-surface/95 backdrop-blur-md flex items-center justify-center px-6">
          <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-sm w-full text-center border border-primary/10">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span
                className="material-symbols-outlined text-primary text-4xl"
                style={{ fontVariationSettings: "'wght' 700" }}
              >
                check
              </span>
            </div>
            <h3 className="text-2xl font-black font-headline mb-2">
              Welcome to Pro
            </h3>
            <p className="text-on-surface-variant mb-8">
              Your 14-day free trial has started. Redirecting to your
              dashboard...
            </p>
            <div className="w-full h-1 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-primary w-1/3 rounded-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
