Frontend (apps/web/src/pages/CheckoutPage.tsx)
1. User isi userId, amount, description
2. handleSubmit() validasi lalu fetch POST ${API_BASE}/api/checkout
3. Kalau sukses dapat { orderId } → redirect ke /payment/status/:orderId (halaman status ambil info pembayaran/polling tergantung implementasi)

API Gateway (apps/api-gateway/src/checkout.ts, di-mount jadi /api/checkout dari apps/api-gateway/src/index.ts)
1. Terima request, validasi input
2. Cek userId ada di DB
3. Generate idempotencyKey
4. Insert ke tabel orders dengan status: "pending"
5. Kirim job ke Cloudflare Queue: PAYMENT_QUEUE.send({ type: "process-payment", orderId })
Return cepat ke client: 201 { orderId, status: "pending" }

Payment Worker (Queue Consumer) (apps/payment-worker/src/index.ts)
1. Terima message dari queue payment-jobs
2. Kalau type === "process-payment" → panggil processPayment(...)

Proses pembuatan invoice (apps/payment-worker/src/processPayment.ts)
1. Ambil order dari DB
2. Ambil user untuk payer_email (optional)
3. Panggil Xendit createInvoice() dengan external_id = order.idempotencyKey (ini yang bikin retry aman,   tidak bikin invoice dobel)
4. Update record orders dengan xenditInvoiceId, paymentUrl, expiresAt
5. msg.ack() kalau sukses, msg.retry() kalau error (sesuai max_retries di apps/payment-worker/wrangler.toml)