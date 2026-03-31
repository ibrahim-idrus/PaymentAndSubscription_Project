import { useState } from "react";
import { useNavigate } from "react-router";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";

type PaymentState = "pending" | "paid" | "failed";

export function StatusPage() {
  const [state, setState] = useState<PaymentState>("pending");
  const navigate = useNavigate();

  return (
    <div className="bg-surface text-on-surface min-h-dvh flex flex-col">
      {/* Decorative blurs */}
      <div className="fixed top-0 right-0 -z-10 w-96 h-96 bg-primary/5 blur-[120px] rounded-full" />
      <div className="fixed bottom-0 left-0 -z-10 w-64 h-64 bg-secondary/5 blur-[100px] rounded-full" />

      <Header variant="status" />

      <main className="flex-grow flex items-center justify-center px-4 pt-24 pb-32 md:pb-12">
        <div className="w-full max-w-[480px] space-y-8 text-center">

          {/* Demo switcher */}
          <div className="flex gap-2 justify-center text-xs">
            {(["pending", "paid", "failed"] as PaymentState[]).map((s) => (
              <button
                key={s}
                onClick={() => setState(s)}
                className={`px-3 py-1 rounded-full font-bold uppercase tracking-wide transition-colors ${
                  state === s
                    ? "bg-primary text-white"
                    : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* ── PENDING ── */}
          {state === "pending" && (
            <section className="space-y-8">
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 bg-amber-100 rounded-full animate-[pulse-subtle_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
                <div className="relative bg-amber-500 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg">
                  <span className="material-symbols-outlined text-4xl">schedule</span>
                </div>
              </div>

              <div>
                <h1 className="font-headline text-3xl font-extrabold tracking-tight mb-2">
                  Waiting for Payment
                </h1>
                <p className="text-on-surface-variant leading-relaxed">
                  Complete your payment before the timer runs out.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-6 py-3 bg-surface-container-high rounded-xl">
                <span className="font-mono text-4xl font-medium tracking-tighter text-on-surface">
                  23:47:12
                </span>
              </div>

              {/* Order Card */}
              <div className="bg-surface-container-lowest rounded-2xl p-8 text-left shadow-[0px_24px_48px_-12px_rgba(17,24,39,0.06)] border border-outline-variant/10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">
                      Transaction ID
                    </p>
                    <p className="font-mono text-sm">#ORD-2026-00142</p>
                  </div>
                  <div className="bg-secondary-container px-3 py-1 rounded-full">
                    <span className="text-[10px] font-bold text-on-secondary-container">
                      QRIS
                    </span>
                  </div>
                </div>
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">
                    Total Amount
                  </p>
                  <p className="font-mono text-2xl font-bold text-primary">
                    IDR 299,000
                  </p>
                </div>
                <div className="pt-6 border-t border-outline-variant/10">
                  <div className="flex items-center gap-2 text-on-surface-variant text-sm">
                    <span className="material-symbols-outlined text-lg">
                      event_available
                    </span>
                    <span>
                      Expires:{" "}
                      <span className="font-medium text-on-surface">
                        Mar 28, 2026 at 14:00 WIB
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <button className="w-full bg-primary-container text-on-primary py-4 px-8 rounded-xl font-bold text-lg shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                View Payment Instructions
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </section>
          )}

          {/* ── PAID ── */}
          {state === "paid" && (
            <section className="space-y-8">
              <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <div className="bg-green-600 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg">
                  <span
                    className="material-symbols-outlined text-4xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                </div>
              </div>

              <div>
                <h1 className="font-headline text-3xl font-extrabold tracking-tight mb-2">
                  Payment Successful
                </h1>
                <p className="text-on-surface-variant leading-relaxed">
                  Your Pro Plan subscription is now active.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={() => navigate("/subscription")}
                  className="w-full bg-primary-container text-on-primary py-4 px-8 rounded-xl font-bold text-lg shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">dashboard</span>
                  Go to Dashboard
                </button>
                <button className="w-full bg-surface-container-highest text-on-surface py-4 px-8 rounded-xl font-bold text-lg hover:bg-surface-dim transition-all flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined">download</span>
                  Download Receipt
                </button>
              </div>
            </section>
          )}

          {/* ── FAILED ── */}
          {state === "failed" && (
            <section className="space-y-8">
              <div className="w-24 h-24 mx-auto bg-error-container rounded-full flex items-center justify-center">
                <div className="bg-error text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg">
                  <span
                    className="material-symbols-outlined text-4xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    error
                  </span>
                </div>
              </div>

              <div>
                <h1 className="font-headline text-3xl font-extrabold tracking-tight mb-2">
                  Payment Failed
                </h1>
                <p className="text-on-surface-variant leading-relaxed">
                  Your payment could not be processed. Please try again.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={() => navigate("/checkout")}
                  className="w-full bg-primary-container text-on-primary py-4 px-8 rounded-xl font-bold text-lg shadow-lg hover:brightness-110 transition-all"
                >
                  Try Again
                </button>
                <button className="w-full bg-surface-container-highest text-on-surface py-4 px-8 rounded-xl font-bold text-lg hover:bg-surface-dim transition-all flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined">support_agent</span>
                  Contact Support
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
