import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";

// Base URL backend (api-gateway). Endpoint yang dipakai di halaman ini:
// GET /api/orders/:id -> return status + paymentUrl + informasi invoice
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

// Status internal order di DB (bukan status string mentah dari Xendit)
type OrderStatus = "pending" | "paid" | "failed" | "expired";

// Bentuk response dari GET /api/orders/:id
interface OrderData {
  id: string;
  status: OrderStatus;
  paymentUrl: string | null;
  xenditInvoiceId: string | null;
  amount: number;
  currency: string;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatIDR(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function useCountdown(targetDate: string | null): string {
  const [remaining, setRemaining] = useState("—");

  useEffect(() => {
    if (!targetDate) return;

    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Expired");
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setRemaining(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return remaining;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PaymentStatusPage() {
  const { orderId: paramId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  // Form input untuk cek manual orderId + activeId yang sedang dipolling
  const [inputId, setInputId]   = useState(paramId ?? "");
  const [activeId, setActiveId] = useState(paramId ?? "");
  const [order, setOrder]       = useState<OrderData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // timerRef: polling tiap 5 detik sampai status final
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  // redirectedRef: supaya auto-redirect ke Xendit hanya terjadi sekali
  const redirectedRef = useRef(false);
  const countdown     = useCountdown(order?.expiresAt ?? null);

  // Status final: stop polling
  const isTerminal = (s: OrderStatus) =>
    s === "paid" || s === "failed" || s === "expired";

  // Ambil 1 order dari backend (status + paymentUrl). paymentUrl bisa null sampai invoice dibuat.
  async function fetchOrder(id: string) {
    try {
      const res  = await fetch(`${API_BASE}/api/orders/${id}`);
      const data = await res.json() as OrderData & { error?: { message: string } };

      if (!res.ok) throw new Error((data as any).error?.message ?? "Order not found");

      setOrder(data);
      setError(null);

      if (isTerminal(data.status) && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Auto-redirect ke Xendit ketika paymentUrl sudah tersedia (invoice sudah dibuat oleh payment-worker).
      // Ini membuat UX "langsung pindah ke halaman pembayaran" tanpa user harus klik link manual.
      if (data.paymentUrl && data.status === "pending" && !redirectedRef.current) {
        redirectedRef.current = true;
        setTimeout(() => { window.location.href = data.paymentUrl!; }, 3000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load order");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  // Start/restart polling setiap kali activeId berubah
  // Polling diperlukan karena status dibalikkan lewat webhook (webhook-driven), bukan dari response checkout.
  useEffect(() => {
    if (!activeId) return;

    redirectedRef.current = false;
    setLoading(true);

    if (timerRef.current) clearInterval(timerRef.current);
    fetchOrder(activeId);
    timerRef.current = setInterval(() => fetchOrder(activeId), 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeId]);

  // Update orderId yang dipolling dari input manual
  function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    const id = inputId.trim();
    if (!id) return;
    redirectedRef.current = false;
    setActiveId(id);
  }

  // ── Status config ──────────────────────────────────────────────────────────

  const statusConfig = {
    pending: {
      badge: "bg-amber-100 text-amber-700",
      icon: null,
      label: "Waiting for Payment",
      iconName: "schedule",
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
    },
    paid: {
      badge: "bg-green-100 text-green-700",
      icon: null,
      label: "Payment Successful",
      iconName: "check_circle",
      iconBg: "bg-green-50",
      iconColor: "text-[#16A34A]",
    },
    failed: {
      badge: "bg-red-100 text-red-700",
      icon: null,
      label: "Payment Failed",
      iconName: "cancel",
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
    },
    expired: {
      badge: "bg-gray-100 text-gray-600",
      icon: null,
      label: "Payment Expired",
      iconName: "timer_off",
      iconBg: "bg-gray-100",
      iconColor: "text-gray-400",
    },
  } satisfies Record<OrderStatus, object>;

  const cfg = order ? statusConfig[order.status] : null;

  return (
    <div className="min-h-dvh bg-[#FAFAFA] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-[480px] space-y-6">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 bg-[#16A34A] rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-sm">payments</span>
          </div>
          <span className="font-bold text-base tracking-tight">PayFlow</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight">Payment Status</h1>

        {/* Order ID input */}
        <form onSubmit={handleCheck} className="flex gap-2">
          <input
            type="text"
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            placeholder="Enter Order ID (UUID)"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition font-mono"
          />
          <button
            type="submit"
            className="bg-[#16A34A] hover:bg-[#15803d] text-white font-semibold px-5 py-3 rounded-xl text-sm transition-all active:scale-95 whitespace-nowrap"
          >
            Check Status
          </button>
        </form>

        {/* Loading */}
        {loading && !order && (
          <div className="flex items-center justify-center py-12 text-gray-400 gap-3">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Loading order…</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-base mt-0.5">error</span>
            {error}
          </div>
        )}

        {/* Order card */}
        {order && cfg && (
          <>
            {/* Status icon + message */}
            <div className="text-center py-4">
              {order.status === "pending" && !order.paymentUrl ? (
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="animate-spin h-10 w-10 text-amber-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
              ) : (
                <div className={`w-20 h-20 ${(cfg as any).iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <span
                    className={`material-symbols-outlined ${(cfg as any).iconColor} text-4xl`}
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {(cfg as any).iconName}
                  </span>
                </div>
              )}

              <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold ${(cfg as any).badge}`}>
                {(cfg as any).label}
              </span>

              {order.status === "paid" && order.paidAt && (
                <p className="text-sm text-gray-500 mt-2">Paid on {formatDate(order.paidAt)}</p>
              )}

              {order.status === "pending" && order.paymentUrl && (
                <p className="text-sm text-gray-500 mt-2">
                  Redirecting to payment page in 3 seconds…
                </p>
              )}
            </div>

            {/* Detail card */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3 shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Order Details
              </p>

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Order ID</span>
                <span className="font-mono text-xs text-gray-700 truncate max-w-[200px]">{order.id}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-gray-900">{formatIDR(order.amount)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${(cfg as any).badge}`}>
                  {order.status.toUpperCase()}
                </span>
              </div>

              {order.status === "pending" && order.expiresAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Expires in</span>
                  <span className="font-mono font-bold text-amber-600">{countdown}</span>
                </div>
              )}

              {order.expiresAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Expires at</span>
                  <span className="text-gray-700">{formatDate(order.expiresAt)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-700">{formatDate(order.createdAt)}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              {order.status === "pending" && order.paymentUrl && (
                <a
                  href={order.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 bg-[#16A34A] hover:bg-[#15803d] text-white font-bold py-4 rounded-xl text-base shadow-sm transition-all active:scale-[0.98]"
                >
                  Pay Now
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                </a>
              )}

              {order.status === "paid" && (
                <button
                  onClick={() => navigate("/")}
                  className="flex w-full items-center justify-center gap-2 bg-[#16A34A] hover:bg-[#15803d] text-white font-bold py-4 rounded-xl text-base shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-base">dashboard</span>
                  Go to Dashboard
                </button>
              )}

              {order.status === "failed" && (
                <>
                  <button
                    onClick={() => navigate("/checkout")}
                    className="flex w-full items-center justify-center gap-2 bg-[#16A34A] hover:bg-[#15803d] text-white font-bold py-4 rounded-xl text-base shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-base">refresh</span>
                    Try Again
                  </button>
                </>
              )}

              {order.status === "expired" && (
                <button
                  onClick={() => navigate("/checkout")}
                  className="flex w-full items-center justify-center gap-2 bg-[#16A34A] hover:bg-[#15803d] text-white font-bold py-4 rounded-xl text-base shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  Create New Order
                </button>
              )}
            </div>

            {order.status === "pending" && (
              <p className="text-center text-xs text-gray-400">
                Auto-refreshing every 5 seconds…
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
