import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";

  const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

type Customer = {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phoneNumber: string | null;
  phoneCountryCode: string;
  type: "INDIVIDUAL" | "BUSINESS";
  xenditCustomerId: string | null;
  invoiceCount: number;
  createdAt: string;
  // Subscription info (null jika tidak punya subscription aktif)
  subscriptionId: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
};

type InvoiceStatus = "pending" | "paid" | "failed" | "expired" | "refunded";

type CustomerInvoice = {
  id: string;
  referenceId: string;
  invoiceUrl: string | null;
  amount: string;
  currency: string;
  status: InvoiceStatus;
  description: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
};

type CustomerSubscription = {
  subscriptionId: string;
  planName: string | null;
  subscriptionStatus: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
};

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

// yg tampil di front page
export function CustomersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Banner sukses setelah subscribe dari PlansPage
  const subscribedPlan = searchParams.get("subscribed");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<CustomerInvoice[]>([]);
  const [modalSubscription, setModalSubscription] = useState<CustomerSubscription | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);

  async function fetchCustomers(q = "") {
    setLoading(true);
    setError(null);
    try {
      const url = q
        ? `${API_BASE}/api/customers?search=${encodeURIComponent(q)}`
        : `${API_BASE}/api/customers`;
      const res = await fetch(url);
      const json = await res.json() as { data?: Customer[]; error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? "Gagal memuat data pelanggan");
      setCustomers(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, []);

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    fetchCustomers(search);
  }

  // dipakai untuk menampilkan list customers
  async function openCustomerModal(customer: Customer) {
    setSelectedCustomer(customer);
    setCustomerInvoices([]);
    setModalSubscription(null);
    setLoadingInvoices(true);
    try {
      const res = await fetch(`${API_BASE}/api/customers/${customer.id}`);
      const json = await res.json() as {
        data?: { customer: Customer; invoices: CustomerInvoice[]; subscription: CustomerSubscription | null };
        error?: { message: string };
      };
      if (res.ok && json.data) {
        setCustomerInvoices(json.data.invoices);
        setModalSubscription(json.data.subscription ?? null);
      }
    } finally {
      setLoadingInvoices(false);
    }
  }

  function closeModal() {
    setSelectedCustomer(null);
    setCustomerInvoices([]);
    setModalSubscription(null);
  }

  async function handleCancelSubscription() {
    if (!modalSubscription) return;
    if (!window.confirm("Yakin ingin membatalkan subscription? Akses tetap aktif hingga akhir periode.")) return;
    setCancellingSubscription(true);
    try {
      const res = await fetch(`${API_BASE}/api/subscriptions/${modalSubscription.subscriptionId}/cancel`, {
        method: "POST",
      });
      const json = await res.json() as { error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message ?? "Gagal membatalkan subscription");
      // Reload data modal untuk reflect perubahan cancelAtPeriodEnd
      if (selectedCustomer) await openCustomerModal(selectedCustomer);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setCancellingSubscription(false);
    }
  }

  const unpaidInvoices = customerInvoices.filter(
    (inv) => inv.status === "pending" || inv.status === "failed" || inv.status === "expired"
  );

  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-gray-900">
      {/* Top Nav */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <div className="w-full max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#16A34A] rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-base">payments</span>
            </div>
            <span className="font-bold text-lg tracking-tight">PayFlow</span>
          </div>
          <nav className="flex items-center gap-1">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition"
            >
              <span className="material-symbols-outlined text-base">dashboard</span>
              Dashboard
            </button>
            <button
              onClick={() => navigate("/customers")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-[#16A34A]/10 text-[#16A34A] transition"
            >
              <span className="material-symbols-outlined text-base">group</span>
              Pelanggan
            </button>
          </nav>
        </div>
      </header>

      <div className="w-full max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pelanggan</h1>
            <p className="text-sm text-gray-500 mt-1">Kelola data pelanggan</p>
          </div>
          <button
            onClick={() => navigate("/customers/new")}
            className="flex items-center gap-2 bg-[#16A34A] hover:bg-[#15803d] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition active:scale-95"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            Tambah Pelanggan
          </button>
        </div>

        {/* Banner sukses setelah subscribe */}
        {subscribedPlan && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-2xl px-5 py-4 mb-6">
            <span
              className="material-symbols-outlined text-[#16A34A] text-xl shrink-0"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
            <span>
              You have been subscribed to{" "}
              <span className="font-bold">{subscribedPlan}</span>.
            </span>
          </div>
        )}

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama pelanggan atau perusahaan…"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition"
          />
          <button
            type="submit"
            className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-semibold px-4 py-2.5 rounded-xl transition active:scale-95"
          >
            <span className="material-symbols-outlined text-base">search</span>
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); fetchCustomers(); }}
              className="text-gray-400 hover:text-gray-600 text-sm px-2"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </form>

        {/* Tombol Buat Invoice — terpisah dari card pelanggan */}
        <button
          onClick={() => navigate("/invoices/new")}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-[#16A34A]/50 hover:border-[#16A34A] bg-[#16A34A]/5 hover:bg-[#16A34A]/10 text-[#16A34A] text-sm font-semibold px-4 py-3 rounded-xl transition active:scale-[0.99] mb-6"
        >
          <span className="material-symbols-outlined text-base">receipt_long</span>
          Buat Invoice
        </button>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
            <span className="material-symbols-outlined text-base mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16 text-gray-400">
            <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && customers.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <span className="material-symbols-outlined text-5xl mb-3 block">group_off</span>
            <p className="text-sm">
              {search ? "Pelanggan tidak ditemukan." : "Belum ada pelanggan. Tambahkan pelanggan pertama."}
            </p>
          </div>
        )}

        {/* Customer list */}
        {!loading && customers.length > 0 && (
          <div className="space-y-3">
            {customers.map((c) => (
              <button
                key={c.id}
                onClick={() => openCustomerModal(c)}
                className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 flex items-center justify-between hover:border-[#16A34A]/40 hover:shadow-sm active:scale-[0.99] transition-all group text-left"
              >
                {/* compayname,name, email itu semua diambil dri type customer */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-gray-500 text-xl">
                      {c.type === "BUSINESS" ? "business" : "person"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{c.name}</p>
                    
                    {c.companyName && (
                      <p className="text-xs text-gray-500 truncate">{c.companyName}</p>
                    )}
                    {c.email && (
                      <p className="text-xs text-gray-400 truncate">{c.email}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {c.planName && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A] bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse inline-block" />
                      {c.planName}
                    </span>
                  )}
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Invoice</p>
                    <p className="text-sm font-bold text-gray-700">{c.invoiceCount}</p>
                  </div>
                  <span className="material-symbols-outlined text-gray-300 group-hover:text-[#16A34A] text-base transition">
                    chevron_right
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal detail pelanggan */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-gray-500 text-base">
                    {selectedCustomer.type === "BUSINESS" ? "business" : "person"}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">{selectedCustomer.name}</p>
                  {selectedCustomer.companyName && (
                    <p className="text-xs text-gray-400">{selectedCustomer.companyName}</p>
                  )}
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-gray-400"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Info pelanggan */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Data Pelanggan</p>
                <InfoRow icon="badge" label="Tipe" value={selectedCustomer.type === "BUSINESS" ? "Bisnis" : "Individual"} />
                {selectedCustomer.email && (
                  <InfoRow icon="email" label="Email" value={selectedCustomer.email} />
                )}
                {selectedCustomer.phoneNumber && (
                  <InfoRow
                    icon="phone"
                    label="No. HP"
                    value={`${selectedCustomer.phoneCountryCode}${selectedCustomer.phoneNumber}`}
                  />
                )}
                <InfoRow icon="calendar_today" label="Bergabung" value={formatDate(selectedCustomer.createdAt)} />
                {selectedCustomer.xenditCustomerId && (
                  <InfoRow icon="tag" label="ID Xendit" value={selectedCustomer.xenditCustomerId} mono />
                )}
              </div>

              {/* Subscription info */}
              {!loadingInvoices && modalSubscription && (
                <div className={`border rounded-2xl p-4 space-y-2.5 ${modalSubscription.cancelAtPeriodEnd ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Subscription</p>
                    {modalSubscription.cancelAtPeriodEnd ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-white border border-orange-200 px-2.5 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-xs">schedule</span>
                        Akan berakhir
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#16A34A] bg-white border border-green-200 px-2.5 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse inline-block" />
                        Aktif
                      </span>
                    )}
                  </div>
                  <InfoRow icon="sell" label="Plan" value={modalSubscription.planName ?? "—"} />
                  <InfoRow icon="calendar_today" label="Mulai" value={formatDate(modalSubscription.currentPeriodStart)} />
                  <InfoRow
                    icon="event"
                    label={modalSubscription.cancelAtPeriodEnd ? "Berakhir pada" : "Perpanjang pada"}
                    value={formatDate(modalSubscription.currentPeriodEnd)}
                  />
                  <InfoRow icon="tag" label="Referensi ID" value={modalSubscription.subscriptionId} mono />
                  {modalSubscription.cancelAtPeriodEnd && (
                    <p className="text-xs text-orange-600 pt-1">
                      Akses tetap aktif hingga {formatDate(modalSubscription.currentPeriodEnd)}.
                    </p>
                  )}
                </div>
              )}

              {/* Invoice ringkasan */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    Invoice ({selectedCustomer.invoiceCount})
                  </p>
                  {unpaidInvoices.length > 0 && (
                    <span className="text-xs font-bold text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                      {unpaidInvoices.length} belum lunas
                    </span>
                  )}
                </div>

                {loadingInvoices && (
                  <div className="flex justify-center py-6 text-gray-400">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                )}

                {!loadingInvoices && customerInvoices.length === 0 && (
                  <div className="text-center py-6 text-gray-400">
                    <span className="material-symbols-outlined text-3xl block mb-1">receipt_long</span>
                    <p className="text-xs">Belum ada invoice</p>
                  </div>
                )}

                {!loadingInvoices && customerInvoices.length > 0 && (
                  <div className="space-y-2">
                    {customerInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="bg-white border border-gray-100 rounded-xl px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-xs font-mono text-gray-500 truncate">{inv.referenceId}</p>
                          <span
                            className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[inv.status]}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[inv.status]}`} />
                            {STATUS_LABEL[inv.status]}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-gray-900">{formatRupiah(inv.amount)}</p>
                          <p className="text-xs text-gray-400">{formatDate(inv.createdAt)}</p>
                        </div>
                        {inv.description && (
                          <p className="text-xs text-gray-400 mt-1 truncate">{inv.description}</p>
                        )}
                        {/* Link pembayaran untuk invoice yg belum lunas */}
                        {inv.invoiceUrl && (inv.status === "pending" || inv.status === "failed" || inv.status === "expired") && (
                          <a
                            href={inv.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-[#16A34A] bg-[#16A34A]/5 hover:bg-[#16A34A]/10 border border-[#16A34A]/20 px-3 py-2 rounded-lg transition"
                          >
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                            Buka Link Pembayaran
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-4 border-t border-gray-100 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => { closeModal(); navigate(`/invoices/new?customerId=${selectedCustomer.id}`); }}
                  className="flex-1 bg-[#16A34A] hover:bg-[#15803d] text-white font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 transition"
                >
                  <span className="material-symbols-outlined text-base">receipt_long</span>
                  Buat Invoice
                </button>
                <button
                  onClick={closeModal}
                  className="px-4 border border-gray-200 hover:border-gray-300 bg-white text-gray-600 font-semibold py-3 rounded-2xl text-sm transition"
                >
                  Tutup
                </button>
              </div>
              {/* Tombol cancel subscription — hanya muncul jika ada subscription aktif & belum di-cancel */}
              {modalSubscription && !modalSubscription.cancelAtPeriodEnd && (
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancellingSubscription}
                  className="w-full py-2.5 rounded-2xl text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">cancel</span>
                  {cancellingSubscription ? "Membatalkan…" : "Batalkan Subscription"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
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
