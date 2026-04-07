import { useState, useEffect } from "react";
import { useNavigate } from "react-router";

// buat manggil API dari env dan jika gagal bakal balik ke localhost
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

type InvoiceStatus = "pending" | "paid" | "failed" | "expired" | "refunded";

type Invoice = {
  id: string;
  customerId: string;
  referenceId: string;
  xenditInvoiceId: string | null;
  invoiceUrl: string | null;
  amount: string;
  currency: string;
  status: InvoiceStatus;
  description: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerPhoneCountryCode: string;
  customerCompanyName: string | null;
};

type FilterTab = "all" | "pending" | "paid" | "failed";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  pending: "Belum Dibayar",
  paid: "Lunas",
  failed: "Gagal",
  expired: "Kadaluarsa",
  refunded: "Dikembalikan",
};

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  paid: "bg-green-100 text-[#16A34A] border-green-200",
  failed: "bg-red-100 text-red-600 border-red-200",
  expired: "bg-gray-100 text-gray-500 border-gray-200",
  refunded: "bg-blue-100 text-blue-600 border-blue-200",
};

const STATUS_DOT: Record<InvoiceStatus, string> = {
  pending: "bg-yellow-400",
  paid: "bg-[#16A34A]",
  failed: "bg-red-500",
  expired: "bg-gray-400",
  refunded: "bg-blue-400",
};

function formatRupiah(amount: string | number) {
  return `Rp ${Number(amount).toLocaleString("id-ID")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Tempalate buat fitur lain
export function DashboardPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ngasih tau tab yg belum bayar dan sudah bayar di dasboard
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  // buat buka modul invoice didashboard
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // buat rngambil ivoice dan buat logic jika ada kesalahan seperti jaringan jelek, datanya gaa ada bakal ada pesan errornya
  useEffect(() => {
    async function fetchInvoices() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/invoices`);
        const json = await res.json() as { data?: Invoice[]; error?: { message: string } };
        if (!res.ok) throw new Error(json.error?.message ?? "Gagal memuat invoice");
        setInvoices(json.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, []);

  const filtered = invoices.filter((inv) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return inv.status === "pending";
    if (activeTab === "paid") return inv.status === "paid";
    if (activeTab === "failed") return inv.status === "failed" || inv.status === "expired";
    return true;
  });

  const counts = {
    all: invoices.length,
    pending: invoices.filter((i) => i.status === "pending").length,
    paid: invoices.filter((i) => i.status === "paid").length,
    failed: invoices.filter((i) => i.status === "failed" || i.status === "expired").length,
  };

  const tabs: { key: FilterTab; label: string; icon: string }[] = [
    { key: "all", label: "Semua", icon: "receipt_long" },
    { key: "pending", label: "Belum Dibayar", icon: "schedule" },
    { key: "paid", label: "Lunas", icon: "check_circle" },
    { key: "failed", label: "Gagal / Kadaluarsa", icon: "cancel" },
  ];

  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-gray-900">
      {/* Top Nav */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#16A34A] rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-base">payments</span>
            </div>
            <span className="font-bold text-lg tracking-tight">PayFlow</span>
          </div>
          <nav className="flex items-center gap-1">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-[#16A34A]/10 text-[#16A34A] transition"
            >
              <span className="material-symbols-outlined text-base">dashboard</span>
              Dashboard
            </button>
            <button
              onClick={() => navigate("/customers")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition"
            >
              <span className="material-symbols-outlined text-base">group</span>
              Pelanggan
            </button>
          </nav>
        </div>
      </header>

      <div className="w-full max-w-5xl mx-auto px-4 py-8">

        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Invoice</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor semua tagihan pelanggan</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-xs text-gray-400 mb-1">Total Invoice</p>
            <p className="text-2xl font-bold text-gray-900">{counts.all}</p>
          </div>
          <div className="bg-white border border-yellow-100 rounded-2xl p-4">
            <p className="text-xs text-yellow-600 mb-1">Belum Dibayar</p>
            <p className="text-2xl font-bold text-yellow-600">{counts.pending}</p>
          </div>
          <div className="bg-white border border-green-100 rounded-2xl p-4">
            <p className="text-xs text-[#16A34A] mb-1">Lunas</p>
            <p className="text-2xl font-bold text-[#16A34A]">{counts.paid}</p>
          </div>
          <div className="bg-white border border-red-100 rounded-2xl p-4">
            <p className="text-xs text-red-500 mb-1">Gagal / Kadaluarsa</p>
            <p className="text-2xl font-bold text-red-500">{counts.failed}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 mb-6 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "bg-[#16A34A] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              {tab.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
            <span className="material-symbols-outlined text-base mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20 text-gray-400">
            <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <span className="material-symbols-outlined text-5xl mb-3 block">receipt_long</span>
            <p className="text-sm">
              {activeTab === "all" ? "Belum ada invoice." : "Tidak ada invoice dengan status ini."}
            </p>
          </div>
        )}

        {/* Invoice grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((inv) => (
              <button
                key={inv.id}
                onClick={() => setSelectedInvoice(inv)}
                className="bg-white border border-gray-100 rounded-2xl p-5 text-left hover:border-[#16A34A]/40 hover:shadow-md active:scale-[0.98] transition-all group"
              >
                {/* Status badge */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLOR[inv.status]}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[inv.status]}`} />
                    {STATUS_LABEL[inv.status]}
                  </span>
                  <span className="material-symbols-outlined text-gray-300 group-hover:text-[#16A34A] text-base transition">
                    open_in_new
                  </span>
                </div>

                {/* Customer */}
                <div className="mb-3">
                  <p className="font-semibold text-sm text-gray-900 truncate">{inv.customerName}</p>
                  {inv.customerCompanyName && (
                    <p className="text-xs text-gray-400 truncate">{inv.customerCompanyName}</p>
                  )}
                  {inv.customerEmail && (
                    <p className="text-xs text-gray-400 truncate">{inv.customerEmail}</p>
                  )}
                </div>

                {/* Amount */}
                <p className="text-lg font-bold text-gray-900 mb-1">{formatRupiah(inv.amount)}</p>

                {/* Description */}
                {inv.description && (
                  <p className="text-xs text-gray-500 truncate mb-2">{inv.description}</p>
                )}

                {/* Date */}
                <p className="text-xs text-gray-400 mt-auto">{formatDate(inv.createdAt)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal detail invoice */}
      {selectedInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedInvoice(null); }}
        >
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-[fadeSlideUp_0.2s_ease]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#16A34A]">receipt_long</span>
                <span className="font-bold text-base">Detail Invoice</span>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-gray-400"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Status */}
              <div className="flex justify-center">
                <span
                  className={`inline-flex items-center gap-2 text-sm font-bold px-4 py-1.5 rounded-full border ${STATUS_COLOR[selectedInvoice.status]}`}
                >
                  <span className={`w-2 h-2 rounded-full ${STATUS_DOT[selectedInvoice.status]}`} />
                  {STATUS_LABEL[selectedInvoice.status]}
                </span>
              </div>

              {/* Amount */}
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{formatRupiah(selectedInvoice.amount)}</p>
                <p className="text-sm text-gray-400 mt-1">{selectedInvoice.currency}</p>
              </div>

              {/* Data pelanggan */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Data Pelanggan</p>
                <Row icon="person" label="Nama" value={selectedInvoice.customerName} />
                {selectedInvoice.customerCompanyName && (
                  <Row icon="business" label="Perusahaan" value={selectedInvoice.customerCompanyName} />
                )}
                {selectedInvoice.customerEmail && (
                  <Row icon="email" label="Email" value={selectedInvoice.customerEmail} />
                )}
                {selectedInvoice.customerPhone && (
                  <Row
                    icon="phone"
                    label="No. HP"
                    value={`${selectedInvoice.customerPhoneCountryCode}${selectedInvoice.customerPhone}`}
                  />
                )}
              </div>

              {/* Data invoice */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Data Invoice</p>
                <Row icon="tag" label="ID Invoice" value={selectedInvoice.referenceId} mono />
                {selectedInvoice.description && (
                  <Row icon="notes" label="Deskripsi" value={selectedInvoice.description} />
                )}
                <Row icon="calendar_today" label="Dibuat" value={formatDate(selectedInvoice.createdAt)} />
                {selectedInvoice.expiresAt && (
                  <Row icon="event_busy" label="Kadaluarsa" value={formatDate(selectedInvoice.expiresAt)} />
                )}
                {selectedInvoice.paidAt && (
                  <Row icon="check_circle" label="Dibayar" value={formatDate(selectedInvoice.paidAt)} />
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-6 pb-6 pt-4 space-y-2 border-t border-gray-100">
              {selectedInvoice.invoiceUrl && selectedInvoice.status === "pending" && (
                <a
                  href={selectedInvoice.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#16A34A] hover:bg-[#15803d] text-white font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition"
                >
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                  Buka Link Pembayaran
                </a>
              )}
              {selectedInvoice.invoiceUrl && selectedInvoice.status !== "pending" && (
                <a
                  href={selectedInvoice.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full border border-gray-200 hover:border-gray-300 bg-white text-gray-700 font-semibold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 transition"
                >
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                  Lihat Invoice Xendit
                </a>
              )}
              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: string;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined text-gray-400 text-base mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`text-sm font-semibold text-gray-800 break-all ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}
