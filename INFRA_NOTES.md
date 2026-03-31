# Catatan Infrastruktur (Payflow)

Tanggal: 2026-03-30

Frontend = apps/Web
Backend = apps/API-Gateway



## 1) Apps/Workers yang dipakai

Workspace ini pakai pola monorepo `apps/*` + `packages/*`.

- Frontend (Web UI): `apps/web`
  - Stack: Vite + React + Tailwind.
  - Tujuan: tempat kamu naruh design web + komponen UI (shadcn-friendly).

- Backend (HTTP entry point / router): `apps/api-gateway`
  - Stack: Cloudflare Workers (Wrangler) + Hono.
  - Worker name (Wrangler): `payflow-api-gateway` (lihat `apps/api-gateway/wrangler.toml`).
  - Tujuan: nerima request HTTP (`/api/*`), akses DB, dan nanti bisa jadi “router” untuk enqueue job ke Queues / upload ke R2.

Saat ini belum ada worker consumer lain (contoh: `payment-consumer`, `webhook-consumer`, dll). Kalau nanti kamu mau pakai Cloudflare Queues, biasanya kamu bikin worker terpisah per-queue (1 queue = 1 consumer) atau 1 worker consume beberapa queue.

## 2) Cloudflare Queues: nyambung kemana?

Saat ini **belum dikonfigurasi** di `apps/api-gateway/wrangler.toml` (belum ada blok `[[queues.producers]]` / `[[queues.consumers]]`).

Konsep wiring-nya (yang nanti kamu akan pakai):

- Producer (biasanya `api-gateway`):
  - menerima request (mis. `POST /api/jobs`), validasi payload, lalu `env.EMAIL_QUEUE.send(...)` / `env.IMAGE_QUEUE.send(...)` / dll.

- Consumer (worker per queue):
  - worker dipanggil oleh Cloudflare saat ada message masuk ke queue.
  - di Hono/worker handler, kamu proses message, lalu (opsional) akses DB / R2.

Contoh mapping yang kamu sebut:
- `email` → `EMAIL_QUEUE`
- `image` → `IMAGE_QUEUE`
- `analytics` → `ANALYTICS_QUEUE`

Yang perlu kamu tentukan nanti:
- Nama queue di Cloudflare dashboard (mis. `email-queue`, `image-queue`, `analytics-queue`).
- Worker mana yang jadi producer dan consumer.

## 3) Cloudflare R2 Bucket: nyambung kemana?

Saat ini **belum ada binding R2** di `apps/api-gateway/wrangler.toml` (belum ada blok `[[r2_buckets]]`).

Wiring yang umum:
- `api-gateway` menerima upload request atau URL file, lalu:
  - simpan file ke R2 bucket (mis. `env.IMAGE_BUCKET.put(key, data)`), atau
  - generate signed URL untuk client upload langsung.
- Consumer worker (mis. `image-consumer`) bisa:
  - ambil file dari R2 untuk proses (resize, virus scan, dll), lalu simpan hasil kembali ke R2.

Kamu perlu tentukan:
- Nama bucket (mis. `payflow-images`).
- Worker mana yang punya binding bucket tersebut.

## 4) DrizzleORM + NeonDB: masuk project mana dan database mana?

### Masuk project mana?
- Package DB ada di: `packages/db`
  - `packages/db/src/index.ts` expose `createDb(databaseUrl)`.
  - Driver yang dipakai: `@neondatabase/serverless` + `drizzle-orm/neon-http`.

- Worker yang memakai DB saat ini:
  - `apps/api-gateway/src/index.ts` membuat DB client lewat `createDb(c.env.DATABASE_URL)`.

### Database mana?
- Sumber koneksi DB adalah env var/secret `DATABASE_URL`.
  - Dideklarasikan sebagai secret di `apps/api-gateway/wrangler.toml` (komentar: set via `wrangler secret put DATABASE_URL`).

Jadi “database mana” = **database Neon yang URL-nya kamu simpan ke secret `DATABASE_URL`**.
Catatan: dari repo saja kita tidak bisa tahu nama project/database Neon-nya, karena URL-nya tidak disimpan di git.

## 5) PostHog

Aku **tidak menambahkan PostHog** ke project ini.
- `apps/web/package.json` saat ini tidak memiliki dependency `posthog-js` atau `@posthog/react`.
- Jadi tidak perlu install PostHog kecuali kamu memang mau tracking analytics.

---

## Checklist kalau mau lanjut implement Queues/R2

1) Tentukan daftar queue + bucket yang kamu butuh.
2) Tambahkan bindings di `apps/api-gateway/wrangler.toml`.
3) (Opsional) Tambah worker consumer baru di `apps/*` per queue.
4) Update root scripts untuk dev/deploy worker-worker itu.





Ya, sudah ter-install di PaymentAndSubscription_Project (terdeteksi di node_modules):

Cloudflare (Wrangler): apps/api-gateway/node_modules/wrangler versi 4.78.0
Hono: apps/api-gateway/node_modules/hono versi 4.12.9
DrizzleORM: packages/db/node_modules/drizzle-orm versi 0.45.2
NeonDB driver: packages/db/node_modules/@neondatabase/serverless versi 1.0.2