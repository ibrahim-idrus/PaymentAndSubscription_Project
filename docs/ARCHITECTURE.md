# PayFlow — Dokumentasi Arsitektur Backend

Dokumen ini menjelaskan secara menyeluruh bagaimana backend PayFlow bekerja:
workers, queue, shared utilities, database, dan alur logika lengkapnya dari
awal request user hingga data tersimpan di database.

---

## Daftar Isi

1. [Gambaran Umum Sistem](#1-gambaran-umum-sistem)
2. [Workers — Penjelasan Detail](#2-workers--penjelasan-detail)
3. [Queues — Penjelasan Detail](#3-queues--penjelasan-detail)
4. [Packages Utils — Penjelasan Detail](#4-packages-utils--penjelasan-detail)
5. [Hubungan Workers, Queue, dan Utils](#5-hubungan-workers-queue-dan-utils)
6. [Alur Logika Backend Lengkap](#6-alur-logika-backend-lengkap)
7. [Database Schema dan Relasi](#7-database-schema-dan-relasi)

---

## 1. Gambaran Umum Sistem

PayFlow menggunakan arsitektur **event-driven** berbasis Cloudflare Workers dan
Cloudflare Queues. Setiap komponen memiliki satu tanggung jawab yang jelas dan
berkomunikasi satu sama lain **hanya melalui queue** — tidak ada saling memanggil
langsung antar worker.

```
                         ┌─────────────────────┐
  User / Frontend        │     api-gateway      │   ← Hono HTTP server
  ──────────────►        │  (Cloudflare Worker) │
                         └──────────┬──────────┘
                                    │ POST ke webhook route
                                    ▼
                         ┌─────────────────────┐
  Xendit (Payment GW)    │   webhook-jobs queue │
  ──────────────►        └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   webhook-worker     │  ← verifikasi token + routing event
                         └────────┬────────────┘
                          ┌───────┴────────┐
                          ▼                ▼
               ┌──────────────────┐  ┌──────────────────┐
               │ subscription-    │  │   payment-jobs   │
               │     jobs queue   │  │      queue       │
               └────────┬─────────┘  └────────┬─────────┘
                        ▼                      ▼
             ┌──────────────────┐   ┌──────────────────┐
             │ subscription-    │   │  payment-worker  │
             │    worker        │   │                  │
             └────────┬─────────┘   └────────┬─────────┘
                      │                       │
                      ▼                       ▼
               ┌──────────────────────────────────┐
               │        notification-jobs queue    │
               └──────────────────┬───────────────┘
                                  ▼
                       ┌──────────────────┐
                       │ notification-    │   ← kirim email
                       │    worker        │
                       └──────────────────┘

                       ┌──────────────────┐
                       │  renewal-cron    │   ← jalan tiap jam (scheduled)
                       └──┬──────────┬───┘
                          │          │
                          ▼          ▼
               subscription-    notification-
                jobs queue       jobs queue
```

Komponen utama:

| Komponen | Jenis | Peran |
|---|---|---|
| `api-gateway` | HTTP Worker (Hono) | Entry point semua request dari frontend |
| `webhook-worker` | Queue Consumer | Terima & validasi event Xendit |
| `payment-worker` | Queue Consumer | Proses pembayaran & refund via Xendit API |
| `subscription-worker` | Queue Consumer | Update status subscription di database |
| `notification-worker` | Queue Consumer | Kirim email ke user |
| `renewal-cron` | Scheduled Worker | Scan subscription yang mau expired, trigger penagihan |
| `webhook-jobs` | Queue | Tampung event mentah dari Xendit |
| `payment-jobs` | Queue | Job pembayaran (create invoice, refund) |
| `subscription-jobs` | Queue | Job update status subscription |
| `notification-jobs` | Queue | Job pengiriman email |

---

## 2. Workers — Penjelasan Detail

### 2.1 `api-gateway`

**File:** `apps/api-gateway/src/index.ts`
**Teknologi:** Hono.js di Cloudflare Workers

Satu-satunya pintu masuk dari luar ke sistem. Semua request HTTP dari frontend
masuk ke sini. Tugasnya:

- Melayani REST API untuk frontend (GET users, subscriptions, payments)
- Menerima POST dari Xendit webhook dan memasukkannya ke `webhook-jobs` queue
- Autentikasi request (verifikasi token user)
- CORS handling untuk frontend lokal maupun production

**Yang harus dilakukan api-gateway saat user bayar:**
```
1. Terima POST /api/orders dari frontend
2. Buat record order di DB dengan status "pending" + idempotency_key
3. Kirim job ke payment-jobs queue: { type: "process-payment", orderId }
4. Return response ke frontend dengan status 202 Accepted
```

**Yang harus dilakukan api-gateway saat terima webhook Xendit:**
```
1. Terima POST /webhooks/xendit dari Xendit
2. Ambil header "x-callback-token"
3. Kirim raw payload ke webhook-jobs queue
4. Return 200 OK ke Xendit (harus cepat, max 30 detik)
```

> Kenapa harus cepat? Xendit akan retry webhook jika tidak dapat 200 dalam
> waktu tertentu. Dengan queue, api-gateway cukup terima dan simpan dulu,
> proses berat dilakukan oleh worker secara async.

---

### 2.2 `webhook-worker`

**File:** `apps/webhook-worker/src/index.ts`
**Consume:** `webhook-jobs`
**Produce ke:** `subscription-jobs`, `payment-jobs`

Worker yang menjadi **router event Xendit**. Setiap event dari Xendit masuk
ke sini, diverifikasi keasliannya, lalu didistribusikan ke queue yang tepat.

**Job yang bisa diproses:**

| Event Xendit | Aksi |
|---|---|
| `invoice.paid` | Kirim ke `subscription-jobs` → `{ type: "activate" }` |
| `invoice.expired` | Tandai order expired di DB |
| `invoice.payment_failed` | Tandai order failed di DB |
| `recurring_payment.made` | Kirim ke `subscription-jobs` → `{ type: "renew" }` |
| `recurring_payment.missed` | Kirim ke `subscription-jobs` → `{ type: "cancel" }` |
| `recurring_payment.failed` | Kirim ke `subscription-jobs` → `{ type: "cancel" }` |

**Implementasi yang harus ada (TODO):**
```typescript
// 1. Verifikasi token (WAJIB — security critical)
const token = request.headers.get("x-callback-token") ?? "";
if (!verifyXenditWebhook(token, env.XENDIT_WEBHOOK_TOKEN)) {
  return new Response("Unauthorized", { status: 401 });
}

// 2. Cek idempotency — apakah event ini sudah pernah diproses?
const existing = await db.query.webhookEvents.findFirst({
  where: eq(webhookEvents.id, event.id),
});
if (existing) {
  message.ack(); // sudah diproses, skip
  return;
}

// 3. Simpan event ke DB (mencegah duplikasi)
await db.insert(webhookEvents).values({ id: event.id, type: event.type, payload: event });

// 4. Route ke queue yang sesuai
```

**Environment yang dibutuhkan:**
- `DATABASE_URL` — koneksi ke PostgreSQL
- `XENDIT_WEBHOOK_TOKEN` — token rahasia dari Xendit dashboard
- `PAYMENT_QUEUE` — binding ke payment-jobs
- `SUBSCRIPTION_QUEUE` — binding ke subscription-jobs

---

### 2.3 `payment-worker`

**File:** `apps/payment-worker/src/index.ts`
**Consume:** `payment-jobs`
**Produce ke:** `subscription-jobs`, `notification-jobs`

Worker yang menangani **semua komunikasi ke Xendit API**. Ketika ada job
pembayaran masuk, worker ini yang memanggil `createInvoice()` atau memproses
refund.

**Job yang bisa diproses:**

| Job Type | Aksi |
|---|---|
| `process-payment` | Panggil `createInvoice()` di Xendit, simpan `xendit_invoice_id` ke orders |
| `refund` | Panggil Xendit refund API, update status order menjadi "refunded" |

**Implementasi yang harus ada (TODO):**
```typescript
case "process-payment": {
  // Ambil data order dari DB
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, job.orderId)
  });

  // Buat invoice di Xendit
  const invoice = await createInvoice(env.XENDIT_API_KEY, {
    external_id: order.idempotencyKey, // gunakan idempotency key yang sudah ada
    amount: Number(order.amount),
    payer_email: user.email,
    description: `PayFlow - ${plan.name}`,
    currency: order.currency,
  });

  // Simpan xendit_invoice_id ke DB
  await db.update(orders)
    .set({ xenditInvoiceId: invoice.id, paymentUrl: invoice.invoice_url })
    .where(eq(orders.id, job.orderId));

  break;
}
```

**Environment yang dibutuhkan:**
- `DATABASE_URL`
- `XENDIT_API_KEY` — API key Xendit untuk memanggil API
- `SUBSCRIPTION_QUEUE`
- `NOTIFICATION_QUEUE`

---

### 2.4 `subscription-worker`

**File:** `apps/subscription-worker/src/index.ts`
**Consume:** `subscription-jobs`
**Produce ke:** `notification-jobs`

Worker yang **mengelola state subscription di database**. Tidak memanggil
Xendit sama sekali — murni operasi database.

**Job yang bisa diproses:**

| Job Type | Aksi di DB |
|---|---|
| `activate` | Set `subscriptions.status = "active"`, update `users.subscription_status`, hitung `current_period_end` |
| `cancel` | Set `subscriptions.status = "cancelled"`, set `cancelled_at = now()` |
| `renew` | Update `current_period_start`, `current_period_end`, `renews_at` ke periode berikutnya |

**Setelah setiap operasi berhasil**, worker ini mengirim notifikasi:
```typescript
case "activate": {
  // ... update DB ...

  // Kirim notifikasi ke user
  await env.NOTIFICATION_QUEUE.send({
    type: "subscription-activated",
    email: user.email,
    userId: job.userId,
  });
  break;
}
```

**Environment yang dibutuhkan:**
- `DATABASE_URL`
- `NOTIFICATION_QUEUE`

---

### 2.5 `notification-worker`

**File:** `apps/notification-worker/src/index.ts`
**Consume:** `notification-jobs`
**Produce ke:** _(tidak produce ke queue manapun)_

Worker paling akhir dalam pipeline. Tugasnya satu: **kirim email ke user**.

**Job yang bisa diproses:**

| Job Type | Email yang Dikirim |
|---|---|
| `payment-success` | "Pembayaran berhasil, terima kasih!" |
| `payment-failed` | "Pembayaran gagal, silakan coba lagi" |
| `subscription-activated` | "Selamat! Langganan kamu sudah aktif" |
| `subscription-cancelled` | "Langganan kamu telah dibatalkan" |
| `renewal-reminder` | "Langganan kamu akan diperpanjang dalam 24 jam" |

**Implementasi yang harus ada (TODO):**
```typescript
// Integrasi dengan email service (Resend, Mailgun, SendGrid, dll.)
case "payment-success": {
  await sendEmail({
    to: job.email,
    subject: "Pembayaran Berhasil",
    html: renderPaymentSuccessTemplate(job.metadata),
  });
  break;
}
```

**Environment yang dibutuhkan:**
- `DATABASE_URL`
- `EMAIL_API_KEY` — key dari email service provider

---

### 2.6 `renewal-cron`

**File:** `apps/renewal-cron/src/index.ts`
**Jadwal:** Setiap jam (`0 * * * *`)
**Produce ke:** `subscription-jobs`, `payment-jobs`, `notification-jobs`

Satu-satunya worker yang **tidak dipicu oleh queue**, melainkan oleh jadwal
waktu (cron). Berjalan otomatis setiap jam untuk memeriksa subscription yang
akan expired dalam 24 jam ke depan.

**Yang harus dilakukan setiap jalan:**
```typescript
// 1. Query view v_renewals_due dari DB
const dueRenewals = await db.select().from(vRenewalsDue);

for (const sub of dueRenewals) {
  // 2. Generate deterministic key (mencegah double-charge)
  const idempotencyKey = await deterministicKey(
    "renewal",
    `${sub.userId}:${sub.subscriptionId}:${sub.renewsAt}`
  );

  // 3. Cek apakah sudah ada order untuk renewal ini
  const existing = await db.query.orders.findFirst({
    where: eq(orders.idempotencyKey, idempotencyKey)
  });
  if (existing) continue; // sudah dibuat, skip

  // 4. Kirim reminder ke user
  await env.NOTIFICATION_QUEUE.send({
    type: "renewal-reminder",
    email: sub.email,
    userId: sub.userId,
  });

  // 5. Buat order renewal + trigger payment
  await env.PAYMENT_QUEUE.send({
    type: "process-payment",
    orderId: newOrder.id,
  });
}
```

**Environment yang dibutuhkan:**
- `DATABASE_URL`
- `SUBSCRIPTION_QUEUE`
- `PAYMENT_QUEUE`
- `NOTIFICATION_QUEUE`
- `XENDIT_API_KEY`

---

## 3. Queues — Penjelasan Detail

Semua queue menggunakan **Cloudflare Queues**. Pesan dikirim secara async —
producer tidak menunggu consumer selesai memproses.

### Fitur penting Cloudflare Queues yang dipakai:

- **`message.ack()`** — tandai pesan berhasil diproses, hapus dari queue
- **`message.retry()`** — tandai pesan gagal, Cloudflare akan retry otomatis
- **`max_batch_size`** — berapa banyak pesan diproses sekaligus
- **`max_batch_timeout`** — tunggu maksimal N detik sebelum proses batch meski belum penuh

---

### 3.1 `webhook-jobs`

| Atribut | Nilai |
|---|---|
| Producer | `api-gateway` |
| Consumer | `webhook-worker` |
| Batch size | 10 |
| Batch timeout | 5 detik |

**Isi pesan:** Raw payload webhook dari Xendit (JSON lengkap).

**Kenapa dipisah dari proses utama?**
Xendit mengharuskan respons 200 dalam hitungan detik. Dengan queue, api-gateway
cukup simpan event dan langsung balas 200. Proses validasi dan routing
dilakukan webhook-worker secara async tanpa membuat Xendit timeout.

---

### 3.2 `payment-jobs`

| Atribut | Nilai |
|---|---|
| Producer | `api-gateway`, `renewal-cron` |
| Consumer | `payment-worker` |
| Batch size | 10 |
| Batch timeout | 5 detik |

**Format pesan:**
```typescript
// Buat invoice baru
{ type: "process-payment", orderId: string }

// Proses refund
{ type: "refund", orderId: string, reason: string }
```

**Kenapa diqueue, bukan langsung panggil Xendit API?**
Xendit API bisa lambat atau error. Jika gagal, Cloudflare Queues akan **retry
otomatis** tanpa user tahu ada masalah. Ini membuat sistem lebih resilient.

---

### 3.3 `subscription-jobs`

| Atribut | Nilai |
|---|---|
| Producer | `webhook-worker`, `renewal-cron` |
| Consumer | `subscription-worker` |
| Batch size | 10 |
| Batch timeout | 5 detik |

**Format pesan:**
```typescript
// Aktifkan subscription (setelah invoice.paid)
{ type: "activate", subscriptionId: string, userId: string }

// Batalkan subscription
{ type: "cancel", subscriptionId: string, reason?: string }

// Perpanjang subscription (setelah recurring_payment.made)
{ type: "renew", subscriptionId: string }
```

---

### 3.4 `notification-jobs`

| Atribut | Nilai |
|---|---|
| Producer | `payment-worker`, `subscription-worker`, `renewal-cron` |
| Consumer | `notification-worker` |
| Batch size | 20 (lebih besar karena operasi email lebih ringan) |
| Batch timeout | 5 detik |

**Format pesan:**
```typescript
type NotificationJob = {
  type: "payment-success" | "payment-failed" | "subscription-activated"
      | "subscription-cancelled" | "renewal-reminder";
  email: string;
  userId: string;
  metadata?: Record<string, unknown>; // data tambahan untuk template email
};
```

---

## 4. Packages Utils — Penjelasan Detail

Semua shared logic dikumpulkan di `packages/utils/src/`. Import dari satu
tempat: `@payflow/utils`.

---

### 4.1 `hmac.ts` — Keamanan Webhook

**Lokasi:** `packages/utils/src/hmac.ts`
**Diekspor via:** `@payflow/utils`

File ini berisi fungsi-fungsi untuk **memverifikasi keaslian webhook** dari
Xendit dan untuk **signing/verifying pesan internal**.

#### `verifyXenditWebhook(token, secret)`

Xendit mengirim header `x-callback-token` di setiap webhook. Token ini adalah
string statis yang kamu set di Xendit Dashboard. Fungsi ini memverifikasi
apakah token yang diterima cocok dengan secret yang kamu simpan.

```typescript
// Cara pakai di webhook-worker:
const token = request.headers.get("x-callback-token") ?? "";
const isValid = verifyXenditWebhook(token, env.XENDIT_WEBHOOK_TOKEN);

if (!isValid) {
  return new Response("Unauthorized", { status: 401 });
}
```

**Kenapa tidak pakai `===` biasa?**
Perbandingan string biasa (`a === b`) berhenti di karakter pertama yang
berbeda — artinya makin panjang kecocokannya, makin lama prosesnya.
Attacker bisa mengukur waktu respons untuk menebak token karakter per karakter
(**timing attack**). Fungsi ini menggunakan `timingSafeEqual` yang selalu
memproses seluruh string, sehingga waktu selalu konstan.

#### `hmacSign(secret, payload)`

Membuat tanda tangan HMAC-SHA256 untuk string apapun. Berguna untuk
menandatangani pesan internal antar worker atau API-to-API calls.

```typescript
const signature = await hmacSign(env.INTERNAL_SECRET, JSON.stringify(payload));
// → "3f9a2b1c4d5e6f70a8b9c0d1e2f3a4b5..."
```

Menggunakan **Web Crypto API** (`crypto.subtle`) yang tersedia native di
Cloudflare Workers — tidak butuh library eksternal.

#### `hmacVerify(secret, payload, signature)`

Kebalikan dari `hmacSign`. Memverifikasi bahwa sebuah payload sesuai dengan
signature yang ada.

```typescript
const isValid = await hmacVerify(env.INTERNAL_SECRET, JSON.stringify(payload), receivedSignature);
```

---

### 4.2 `idempotency.ts` — Mencegah Duplikasi

**Lokasi:** `packages/utils/src/idempotency.ts`
**Diekspor via:** `@payflow/utils`

File ini menyelesaikan masalah klasik payment: **bagaimana memastikan user
tidak kena charge dua kali meski ada retry, bug, atau network error?**

#### `generateIdempotencyKey(prefix?)`

Menghasilkan key unik yang tidak bisa diprediksi.

```typescript
const key = generateIdempotencyKey("order");
// → "order_1714000000000_a3f9c2b1d4e7f820"
```

**Format:** `{prefix}_{timestamp}_{16 hex random}`

Digunakan:
- Saat `api-gateway` membuat record order baru → simpan di `orders.idempotency_key`
- Saat `payment-worker` memanggil `createInvoice()` → gunakan sebagai `external_id`
- Xendit akan mengembalikan invoice yang SAMA jika `external_id` yang sama dikirim lagi

**Kenapa tidak pakai `Math.random()`?**
`Math.random()` tidak kriptografis — outputnya bisa diprediksi. Fungsi ini
menggunakan `crypto.getRandomValues()` yang menghasilkan angka benar-benar acak
dari sumber entropi hardware.

#### `deterministicKey(namespace, input)`

Menghasilkan key yang SAMA untuk input yang sama. Digunakan untuk skenario
di mana kamu ingin "satu renewal = satu invoice, tidak peduli berapa kali cron
jalan".

```typescript
// Setiap kali renewal-cron jalan dan menemukan subscription yang sama,
// key yang dihasilkan selalu sama — tidak akan buat duplikasi
const key = await deterministicKey(
  "renewal",
  `${userId}:${subscriptionId}:2026-04`
);
// → "renewal:3f9a2b1c4d5e6f70"
```

Menggunakan SHA-256 dari input sebagai basis, diambil 16 karakter hex pertama
(cukup untuk menghindari collision dalam skala normal).

---

### 4.3 `xendit.ts` — Typed Xendit API Client

**Lokasi:** `packages/utils/src/xendit.ts`
**Diekspor via:** `@payflow/utils`

Semua komunikasi ke Xendit API dikentralisasi di sini. Worker tidak boleh
memanggil Xendit langsung dengan `fetch()` mentah — selalu gunakan fungsi
dari file ini.

#### Autentikasi Xendit

Xendit menggunakan HTTP Basic Auth dengan format khusus:
- Username = API Key kamu (contoh: `xnd_production_abc123...`)
- Password = string kosong `""`

```
Authorization: Basic base64("xnd_production_abc123:")
```

Ini sudah ditangani otomatis oleh fungsi `xenditRequest()` internal.

#### `createInvoice(apiKey, data)`

Membuat invoice pembayaran baru di Xendit. User akan diarahkan ke
`invoice.invoice_url` untuk melakukan pembayaran.

```typescript
const invoice = await createInvoice(env.XENDIT_API_KEY, {
  external_id: generateIdempotencyKey("inv"), // idempotency key
  amount: 99000,                              // Rp 99.000
  payer_email: "user@example.com",
  description: "PayFlow Basic Monthly Plan",
  currency: "IDR",
  success_redirect_url: "https://app.payflow.id/success",
  failure_redirect_url: "https://app.payflow.id/failed",
});

// Simpan ke DB
await db.update(orders).set({
  xenditInvoiceId: invoice.id,
  paymentUrl: invoice.invoice_url,
  expiresAt: invoice.expiry_date,
});

// Redirect user ke halaman pembayaran
return redirect(invoice.invoice_url);
```

#### `getInvoice(apiKey, invoiceId)`

Ambil status invoice terkini dari Xendit. Berguna untuk polling atau
sinkronisasi manual setelah webhook diterima.

```typescript
const invoice = await getInvoice(env.XENDIT_API_KEY, "inv_abc123");
// invoice.status → "PENDING" | "PAID" | "SETTLED" | "EXPIRED"
```

#### `expireInvoice(apiKey, invoiceId)`

Batalkan invoice yang belum dibayar. Digunakan ketika user membatalkan
order dari sisi sistem kamu.

```typescript
await expireInvoice(env.XENDIT_API_KEY, order.xenditInvoiceId);
await db.update(orders).set({ status: "expired" }).where(eq(orders.id, orderId));
```

#### `createCustomer(apiKey, data)`

Buat customer record di Xendit. Diperlukan untuk fitur recurring payment
(berlangganan otomatis). Customer Xendit bisa di-link ke payment method
sehingga renewal bisa dicharge tanpa user perlu input kartu lagi.

```typescript
const customer = await createCustomer(env.XENDIT_API_KEY, {
  reference_id: user.id, // ID user dari DB kamu
  email: user.email,
  given_names: user.fullName,
});

// Simpan xendit_customer_id ke tabel users
await db.update(users).set({ xenditCustomerId: customer.id }).where(eq(users.id, user.id));
```

#### `XenditError`

Class error khusus untuk membedakan error dari Xendit vs error runtime biasa.

```typescript
try {
  await createInvoice(env.XENDIT_API_KEY, data);
} catch (err) {
  if (err instanceof XenditError) {
    // Error dari Xendit API (4xx/5xx)
    console.error("Xendit error:", err.errorCode, err.httpStatus);
    // Contoh: err.errorCode = "DUPLICATE_ERROR" jika external_id sudah ada
  } else {
    // Error lain (network timeout, JSON parse error, dll.)
    throw err;
  }
}
```

---

### 4.4 `index.ts` — Single Entry Point

**Lokasi:** `packages/utils/src/index.ts`
**Import:** `import { ... } from "@payflow/utils"`

File ini adalah "pintu masuk" satu-satunya ke semua utils. Semua worker
dan service import dari `@payflow/utils`, bukan dari file individual.

**Semua yang tersedia:**
```typescript
import {
  // Security
  verifyXenditWebhook,
  hmacSign,
  hmacVerify,

  // Idempotency
  generateIdempotencyKey,
  deterministicKey,

  // Xendit API
  createInvoice,
  getInvoice,
  expireInvoice,
  createCustomer,
  XenditError,

  // Types
  CreateInvoiceInput,
  XenditInvoice,
  CreateCustomerInput,

  // Helpers
  formatAmount,
} from "@payflow/utils";
```

#### `formatAmount(amount, currency)`

Mengformat angka integer ke string mata uang yang human-readable.

```typescript
formatAmount(99000, "IDR"); // → "Rp 99.000"
formatAmount(9900, "USD");  // → "$99.00"
```

Berguna untuk template email di `notification-worker` agar angka tampil
dengan format yang benar untuk user Indonesia.

---

## 5. Hubungan Workers, Queue, dan Utils

Tabel ini menunjukkan utils mana yang dipakai oleh worker mana, dan kapan
digunakan.

| Worker | Utils yang Dipakai | Kapan Dipakai |
|---|---|---|
| `api-gateway` | `generateIdempotencyKey` | Saat membuat record order baru |
| `webhook-worker` | `verifyXenditWebhook` | Validasi setiap webhook yang masuk — **WAJIB, security critical** |
| `payment-worker` | `createInvoice`, `getInvoice`, `expireInvoice`, `generateIdempotencyKey`, `XenditError` | Saat memproses job pembayaran |
| `subscription-worker` | `formatAmount` (opsional) | Untuk template notifikasi |
| `notification-worker` | `formatAmount` | Format harga di body email |
| `renewal-cron` | `createInvoice`, `deterministicKey`, `createCustomer` | Membuat invoice renewal, mencegah double-charge |

**Package yang perlu ditambahkan ke `package.json` ketiga worker:**
```json
// apps/webhook-worker/package.json
// apps/payment-worker/package.json
// apps/renewal-cron/package.json
{
  "dependencies": {
    "@payflow/db": "workspace:*",
    "@payflow/utils": "workspace:*"   // ← belum ada, harus ditambahkan
  }
}
```

---

## 6. Alur Logika Backend Lengkap

### Skenario 1: User Baru Berlangganan

```
1. User pilih plan → POST /api/orders { planId, userId }

2. api-gateway:
   - Generate idempotencyKey = generateIdempotencyKey("order")
   - Insert ke tabel orders { status: "pending", idempotencyKey }
   - Kirim ke payment-jobs: { type: "process-payment", orderId }
   - Return 202 { orderId }

3. payment-worker menerima job:
   - Ambil data order + user dari DB
   - Panggil createInvoice(XENDIT_API_KEY, {
       external_id: order.idempotencyKey,
       amount: plan.price,
       payer_email: user.email,
     })
   - Update orders SET xendit_invoice_id, payment_url, expires_at
   - (Frontend polling atau terima URL dari websocket untuk redirect user)

4. User membayar di halaman Xendit

5. Xendit kirim webhook POST /webhooks/xendit dengan event "invoice.paid"

6. api-gateway:
   - Terima webhook, push ke webhook-jobs queue
   - Return 200 ke Xendit

7. webhook-worker menerima job:
   - Ambil x-callback-token dari payload
   - verifyXenditWebhook(token, XENDIT_WEBHOOK_TOKEN) → harus true
   - Cek webhookEvents table → apakah event ini sudah diproses? (idempotency)
   - Insert ke webhookEvents
   - Kirim ke subscription-jobs: { type: "activate", subscriptionId, userId }

8. subscription-worker menerima job:
   - Update subscriptions SET status = "active", current_period_end = ...
   - Update users SET subscription_status = "active", plan_id = ...
   - Insert ke audit_logs
   - Kirim ke notification-jobs: { type: "subscription-activated", email, userId }

9. notification-worker menerima job:
   - Kirim email "Selamat! Langganan kamu sudah aktif" ke user.email
   - Sertakan detail plan dan tanggal expired
```

---

### Skenario 2: Pembayaran Gagal

```
1. User membayar → gagal (kartu ditolak, dll.)

2. Xendit kirim webhook "invoice.payment_failed"

3. webhook-worker:
   - Verifikasi token
   - Update orders SET status = "failed"
   - Kirim ke notification-jobs: { type: "payment-failed", email, userId }

4. notification-worker:
   - Kirim email "Pembayaran gagal, silakan coba lagi" ke user
```

---

### Skenario 3: Perpanjangan Otomatis (Renewal)

```
1. renewal-cron jalan setiap jam

2. Query view v_renewals_due → dapat daftar subscription yang renews_at
   dalam 24 jam ke depan

3. Untuk setiap subscription:
   a. Generate deterministicKey("renewal", `${userId}:${subId}:${renewsAt}`)
   b. Cek apakah order dengan key ini sudah ada → jika ya, skip (idempotent)
   c. Insert order baru dengan key tersebut + status "pending"
   d. Kirim ke notification-jobs: { type: "renewal-reminder", email }
   e. Kirim ke payment-jobs: { type: "process-payment", orderId }

4. payment-worker membuat invoice Xendit untuk renewal

5. Xendit charge recurring payment → kirim webhook "recurring_payment.made"

6. webhook-worker:
   - Kirim ke subscription-jobs: { type: "renew", subscriptionId }

7. subscription-worker:
   - Update current_period_start, current_period_end, renews_at ke periode baru
   - Kirim ke notification-jobs: { type: "payment-success", email }

8. notification-worker:
   - Kirim email konfirmasi renewal berhasil
```

---

### Skenario 4: User Batalkan Langganan

```
1. User klik "Cancel Subscription" → POST /api/subscriptions/:id/cancel

2. api-gateway:
   - Kirim ke subscription-jobs: { type: "cancel", subscriptionId, reason: "user_request" }

3. subscription-worker:
   - Update subscriptions SET status = "cancelled", cancelled_at = now()
   - Update users SET subscription_status = "cancelled"
   - Insert ke audit_logs
   - Kirim ke notification-jobs: { type: "subscription-cancelled", email }

4. notification-worker:
   - Kirim email "Langganan kamu telah dibatalkan"
```

---

## 7. Database Schema dan Relasi

Semua tabel ada di `packages/db/src/schema.ts`.

### Relasi Antar Tabel

```
plans ──────────────────────────────────────────────────────────┐
  └─ users (plan_id → plans.id)                                  │
       └─ subscriptions (user_id → users.id, plan_id → plans.id)│
            └─ orders (subscription_id → subscriptions.id)      │
                 └─ receipts (order_id → orders.id)             │
                                                                 │
webhook_events ─────────────────────────────────────────────────┤
  └─ audit_logs (webhook_event_id → webhook_events.id)          │
                                                                 │
api_keys ───────────────────────────────────────────────────────┘
```

### Tabel Kunci untuk Setiap Worker

| Worker | Tabel yang Dibaca | Tabel yang Ditulis |
|---|---|---|
| `webhook-worker` | `orders` | `webhook_events`, `audit_logs` |
| `payment-worker` | `orders`, `users`, `plans` | `orders` (update xendit fields) |
| `subscription-worker` | `subscriptions`, `users`, `plans` | `subscriptions`, `users`, `audit_logs` |
| `notification-worker` | `users` | _(tidak tulis, hanya kirim email)_ |
| `renewal-cron` | `v_renewals_due` (view) | `orders` (buat order renewal baru) |

### Views yang Dipakai

| View | Dipakai Oleh | Isi |
|---|---|---|
| `v_renewals_due` | `renewal-cron` | Subscription aktif dengan `renews_at` dalam 24 jam |
| `v_active_subscriptions` | Dashboard admin, api-gateway | Join subscription + user + plan yang status-nya active/trialing/past_due |
| `v_user_payment_summary` | Dashboard admin | Ringkasan total bayar, gagal bayar per user |

### Kolom Penting untuk Idempotency

| Tabel | Kolom | Fungsi |
|---|---|---|
| `orders` | `idempotency_key` | Mencegah order duplikat (UNIQUE constraint) |
| `orders` | `xendit_invoice_id` | Satu invoice Xendit = satu order (UNIQUE constraint) |
| `webhook_events` | `id` | Pakai ID dari Xendit langsung, mencegah proses event yang sama dua kali |
| `users` | `xendit_customer_id` | Link ke customer Xendit untuk recurring payment |

---

_Dokumen ini mencerminkan state kode per April 2026. Bagian yang masih TODO
di kode ditandai dengan catatan implementasi di setiap seksi worker._
