import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

type Customer = {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  type: "INDIVIDUAL" | "BUSINESS";
  invoiceCount: number;
};

/** Preview ID Referensi tanpa memanggil backend (format: acme_Budi_03042026_NNN) */
function previewReferenceId(customer: Customer): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  const num = String(customer.invoiceCount + 1).padStart(3, "0");

  // buat set Id invoicenya
  const sanitize = (s: string) =>
    s.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");

  const company = sanitize(customer.companyName ?? customer.name).toLowerCase();
  const name = sanitize(customer.name);

  return `${company}_${name}_${dd}${mm}${yyyy}_${num}`;
}

export function AddInvoicePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get("customerId");

  const [customers, setCustomers]           = useState<Customer[]>([]);
  const [search, setSearch]                 = useState("");
  const [selectedCustomer, setSelected]     = useState<Customer | null>(null);
  const [showDropdown, setShowDropdown]     = useState(false);
  const [amount, setAmount]                 = useState("");
  const [description, setDescription]       = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [success, setSuccess]               = useState<{ referenceId: string; invoiceUrl: string } | null>(null);

  // Jika ada customerId dari query param, ambil dan preselect pelanggan
  useEffect(() => {
    if (preselectedId) {
      fetchCustomers("").then((list) => {
        const found = list.find((c) => c.id === preselectedId);
        if (found) setSelected(found);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedId]);

  async function fetchCustomers(q: string): Promise<Customer[]> {
    setLoadingCustomers(true);
    try {
      const url = q
        ? `${API_BASE}/api/customers?search=${encodeURIComponent(q)}`
        : `${API_BASE}/api/customers`;
      const res = await fetch(url);
      const json = await res.json() as { data?: Customer[] };
      const list = json.data ?? [];
      setCustomers(list);
      return list;
    } finally {
      setLoadingCustomers(false);
    }
  }

  // Debounce search input
  useEffect(() => {
    if (!showDropdown) return;
    const timer = setTimeout(() => fetchCustomers(search), 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, showDropdown]);

  function selectCustomer(c: Customer) {
    setSelected(c);
    setSearch(c.name);
    setShowDropdown(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedCustomer) {
      setError("Pilih pelanggan terlebih dahulu.");
      return;
    }
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Jumlah harus bilangan positif.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          amount: parsedAmount,
          currency: "IDR",
          description: description.trim() || undefined,
        }),
      });

      const data = await res.json() as {
        data?: { invoice: { referenceId: string; invoiceUrl: string } };
        error?: { message: string };
      };

      if (!res.ok) throw new Error(data.error?.message ?? "Gagal membuat invoice");

      setSuccess({
        referenceId: data.data!.invoice.referenceId,
        invoiceUrl: data.data!.invoice.invoiceUrl ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  // ── Halaman sukses ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-dvh bg-[#FAFAFA] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-[480px] text-center">
          <div className="w-16 h-16 bg-[#16A34A]/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-[#16A34A] text-4xl">check_circle</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Invoice Berhasil Dibuat</h2>
          <p className="text-sm text-gray-500 mb-6">
            ID Referensi: <span className="font-mono font-semibold text-gray-800">{success.referenceId}</span>
          </p>
          <div className="flex flex-col gap-3">
            {success.invoiceUrl && (
              <a
                href={success.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#16A34A] hover:bg-[#15803d] text-white font-bold py-4 rounded-xl text-base flex items-center justify-center gap-2 transition"
              >
                <span className="material-symbols-outlined text-base">open_in_new</span>
                Buka Halaman Invoice
              </a>
            )}
            <button
              onClick={() => { setSuccess(null); setSelected(null); setSearch(""); setAmount(""); setDescription(""); }}
              className="w-full border border-gray-200 hover:border-gray-300 bg-white text-gray-700 font-semibold py-3.5 rounded-xl text-sm transition"
            >
              Buat Invoice Lagi
            </button>
            <button
              onClick={() => navigate("/customers")}
              className="text-sm text-gray-400 hover:text-gray-600 transition"
            >
              Kembali ke Daftar Pelanggan
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form utama ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-gray-900 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-[480px]">

        {/* Header */}
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-[#16A34A] rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-base">receipt_long</span>
          </div>
          <span className="font-bold text-lg tracking-tight">PayFlow</span>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate("/customers")}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Buat Invoice</h1>
            <p className="text-sm text-gray-500">Pilih pelanggan dan masukkan jumlah tagihan</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Pilih Pelanggan */}
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Pelanggan <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
                setShowDropdown(true);
              }}
              onFocus={() => { setShowDropdown(true); fetchCustomers(search); }}
              placeholder="Cari nama pelanggan…"
              autoComplete="off"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition"
            />

            {/* Dropdown hasil pencarian */}
            {showDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
                {loadingCustomers && (
                  <div className="px-4 py-3 text-xs text-gray-400 text-center">Memuat…</div>
                )}
                {!loadingCustomers && customers.length === 0 && (
                  <div className="px-4 py-3 text-xs text-gray-400 text-center">
                    Pelanggan tidak ditemukan.{" "}
                    <button
                      type="button"
                      onClick={() => navigate("/customers/new")}
                      className="text-[#16A34A] font-semibold"
                    >
                      Tambah baru
                    </button>
                  </div>
                )}
                {customers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => selectCustomer(c)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition border-b border-gray-50 last:border-0"
                  >
                    <span className="material-symbols-outlined text-gray-400 text-xl">
                      {c.type === "BUSINESS" ? "business" : "person"}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.name}</p>
                      {c.companyName && <p className="text-xs text-gray-400">{c.companyName}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preview ID Referensi */}
          {selectedCustomer && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1 uppercase tracking-widest font-semibold">ID Referensi Invoice</p>
              <p className="font-mono text-sm font-semibold text-gray-800 break-all">
                {previewReferenceId(selectedCustomer)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Generate otomatis · tidak bisa diubah</p>
            </div>
          )}

          {/* Jumlah */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Jumlah (IDR) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">Rp</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1000"
                step="1000"
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition"
              />
            </div>
          </div>

          {/* Deskripsi */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Deskripsi <span className="normal-case font-normal text-gray-400">(opsional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Keterangan invoice"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition"
            />
          </div>

          {/* Ringkasan */}
          {selectedCustomer && amount && Number(amount) > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Pelanggan</span>
                <span className="font-semibold text-gray-800">{selectedCustomer.name}</span>
              </div>
              {selectedCustomer.companyName && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Perusahaan</span>
                  <span className="text-gray-700">{selectedCustomer.companyName}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-gray-100 pt-2.5">
                <span className="text-gray-500">Total Tagihan</span>
                <span className="font-bold text-gray-900">
                  Rp {Number(amount).toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-base mt-0.5">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !selectedCustomer}
            className="w-full bg-[#16A34A] hover:bg-[#15803d] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-base shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Membuat Invoice…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">send</span>
                Buat Invoice · Rp {Number(amount || 0).toLocaleString("id-ID")}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
