/**
 * @payflow/utils — Shared Utility Library
 *
 * This package is the single source of truth for shared logic across all
 * PayFlow workers and services. Import from here, not from individual files.
 *
 * @example
 * import { verifyXenditWebhook, generateIdempotencyKey, createInvoice } from "@payflow/utils";
 */

// Security: HMAC signing and Xendit webhook verification
export {
  verifyXenditWebhook,
  hmacSign,
  hmacVerify,
} from "./hmac.js";

// Idempotency: prevent duplicate payments and requests
export {
  generateIdempotencyKey,
  deterministicKey,
} from "./idempotency.js";

// Xendit API: typed client for invoices and customers
export {
  createInvoice,
  getInvoice,
  expireInvoice,
  createCustomer,
  XenditError,
} from "./xendit.js";

export type {
  CreateInvoiceInput,
  XenditInvoice,
  CreateCustomerInput,
} from "./xendit.js";

// ─── Currency helpers ────────────────────────────────────────────────────────

/**
 * Format an integer amount to a human-readable currency string.
 *
 * NOTE: For IDR, Xendit uses full integer amounts (99000 = Rp 99.000).
 * For USD, amounts are in cents (9900 = $99.00).
 *
 * @example
 * formatAmount(99000, "IDR") // → "Rp 99.000"
 * formatAmount(9900, "USD")  // → "$99.00"
 */
export function formatAmount(amount: number, currency = "IDR"): string {
  const locale = currency === "IDR" ? "id-ID" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount);
}
