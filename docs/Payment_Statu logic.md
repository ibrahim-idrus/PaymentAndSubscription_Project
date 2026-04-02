1. User checkout → API buat orders status pending lalu enqueue job process-payment.
2. payment-worker buat invoice Xendit, lalu update orders dengan xenditInvoiceId, paymentUrl, expiresAt (status masih pending).
3. Frontend PaymentStatusPage.tsx polling GET /api/orders/:id:
    - Kalau paymentUrl sudah ada dan status masih pending, UI auto-redirect user ke halaman pembayaran Xendit.
4. Setelah user bayar/gagal/expired, Xendit kirim webhook ke webhook-worker:
    - statusHandler.ts (jalur HTTP) memverifikasi token → dedup event → cari order via xenditInvoiceId → update orders.status jadi paid/failed/expired → tulis audit log → enqueue notifikasi/aktivasi subscription (kalau ada).
    - invoiceHandler.ts melakukan hal serupa tapi untuk event yang masuk lewat **queue** webhook-jobs (kalau kamu pakai jalur itu).
5. Karena status berubah lewat webhook, polling di PaymentStatusPage.tsx akhirnya lihat status final dan berhenti polling.