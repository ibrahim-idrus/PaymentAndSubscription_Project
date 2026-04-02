import { useState } from "react";
import { useNavigate } from "react-router";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

type PaymentMethod = "qris" | "va" | "ewallet" | "card";

const paymentMethods: { id: PaymentMethod; icon: string; label: string }[] = [
  { id: "qris",   icon: "qr_code_2",             label: "QRIS"            },
  { id: "va",     icon: "account_balance",        label: "Virtual Account" },
  { id: "ewallet",icon: "account_balance_wallet", label: "E-Wallet"       },
  { id: "card",   icon: "credit_card",            label: "Card"           },
];

export function CheckoutPage() {
  const navigate = useNavigate();

  const [userId, setUserId]           = useState("");
  const [amount, setAmount]           = useState("1000");
  const [description, setDescription] = useState("PayFlow Test Payment");
  const [method, setMethod]           = useState<PaymentMethod>("qris");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!userId.trim()) {
      setError("User ID is required.");
      return;
    }
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId.trim(),
          amount: parsedAmount,
          currency: "IDR",
          description: description.trim() || "PayFlow Payment",
        }),
      });

      const data = await res.json() as { orderId?: string; error?: { message: string } };

      if (!res.ok || !data.orderId) {
        throw new Error(data.error?.message ?? "Failed to create order");
      }

      navigate(`/payment/status/${data.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-gray-900 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-[480px]">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-[#16A34A] rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-base">payments</span>
          </div>
          <span className="font-bold text-lg tracking-tight">PayFlow</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-1">One-Time Payment</h1>
        <p className="text-sm text-gray-500 mb-8">
          Powered by Xendit · Test Mode · No real money charged
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* User ID */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Your User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Amount (IDR)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                Rp
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1000"
                step="1000"
                className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Description <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Payment description"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition"
            />
          </div>

          {/* Payment Method (display only — actual method chosen on Xendit page) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
              Preferred Method
            </label>
            <div className="flex gap-2 flex-wrap">
              {paymentMethods.map((pm) => (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setMethod(pm.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                    method === pm.id
                      ? "bg-[#16A34A] text-white border-[#16A34A] shadow-sm"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{pm.icon}</span>
                  {pm.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              All methods available on the Xendit payment page.
            </p>
          </div>

          {/* Order summary */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex justify-between items-center text-sm mb-3">
              <span className="text-gray-500">Amount</span>
              <span className="font-bold font-mono text-gray-900">
                Rp {Number(amount || 0).toLocaleString("id-ID")}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-3">
              <span className="text-gray-500">Currency</span>
              <span className="font-semibold text-gray-700">IDR</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-base mt-0.5">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#16A34A] hover:bg-[#15803d] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-base shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Creating order…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">lock</span>
                Pay Now · Rp {Number(amount || 0).toLocaleString("id-ID")}
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            Secured by Xendit · 256-bit SSL encryption
          </p>
        </form>
      </div>
    </div>
  );
}
