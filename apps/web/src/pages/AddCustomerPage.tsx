import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

const COUNTRY_CODES = [
  { code: "+62", flag: "🇮🇩", label: "ID" },
  { code: "+1",  flag: "🇺🇸", label: "US" },
  { code: "+60", flag: "🇲🇾", label: "MY" },
  { code: "+65", flag: "🇸🇬", label: "SG" },
];

export function AddCustomerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const [name, setName]                       = useState("");
  const [companyName, setCompanyName]         = useState("");
  const [email, setEmail]                     = useState("");
  const [phoneNumber, setPhoneNumber]         = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+62");
  const [type, setType]                       = useState<"INDIVIDUAL" | "BUSINESS">("INDIVIDUAL");
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Nama wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          companyName: companyName.trim() || undefined,
          email: email.trim() || undefined,
          phoneNumber: phoneNumber.trim() || undefined,
          phoneCountryCode,
          type,
        }),
      });

      const data = await res.json() as { data?: { id: string }; error?: { message: string } };

      if (!res.ok) throw new Error(data.error?.message ?? "Gagal membuat pelanggan");

      navigate(returnTo === "plans" ? "/plans" : "/customers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-gray-900 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-[480px]">

        {/* Header */}
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-[#16A34A] rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-base">person_add</span>
          </div>
          <span className="font-bold text-lg tracking-tight">PayFlow</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/customers")}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tambah Pelanggan</h1>
            <p className="text-sm text-gray-500">Pelanggan akan didaftarkan ke Xendit secara otomatis</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Nama */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Nama <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama individu atau bisnis"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition"
            />
          </div>

          {/* Nama Perusahaan */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Nama Perusahaan <span className="normal-case font-normal text-gray-400">(opsional)</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Nama perusahaan pelanggan"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Dipakai sebagai awalan ID Referensi invoice (contoh: <span className="font-mono">acme_Budi_...</span>)
            </p>
          </div>

          {/* Tipe pelanggan */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Tipe Pelanggan
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "INDIVIDUAL" | "BUSINESS")}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition"
            >
              <option value="INDIVIDUAL">Individual</option>
              <option value="BUSINESS">Bisnis</option>
            </select>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Alamat Email <span className="normal-case font-normal text-gray-400">(opsional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="johndoe@gmail.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition"
            />
          </div>

          {/* Nomor Telepon */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Nomor Telepon <span className="normal-case font-normal text-gray-400">(opsional)</span>
            </label>
            <div className="flex gap-2">
              <select
                value={phoneCountryCode}
                onChange={(e) => setPhoneCountryCode(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition w-28"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="81234567890"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/40 focus:border-[#16A34A] bg-white transition"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-base mt-0.5">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate("/customers")}
              className="flex-1 border border-gray-200 hover:border-gray-300 bg-white text-gray-700 font-semibold py-3.5 rounded-xl text-sm transition active:scale-95"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#16A34A] hover:bg-[#15803d] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm shadow-sm hover:shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Menyimpan…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">check</span>
                  Lanjut
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
