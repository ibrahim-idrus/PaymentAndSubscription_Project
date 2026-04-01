/**
 * xendit.ts — Typed Xendit API Client
 *
 * WHY THIS FILE EXISTS:
 * Xendit is the payment gateway we use to create invoices, process payments,
 * and manage recurring billing. Instead of writing raw fetch() calls scattered
 * across every worker, we centralize all Xendit API logic here.
 *
 * This gives us:
 * - One place to update if Xendit's API changes
 * - TypeScript types for all requests/responses
 * - Consistent error handling across all workers
 * - Easy to extend with new Xendit endpoints later
 *
 * HOW XENDIT AUTH WORKS:
 * Xendit uses HTTP Basic Auth where:
 * - Username = your API key (e.g. "xnd_production_abc123...")
 * - Password = empty string ""
 * So the header looks like: Authorization: Basic base64("xnd_abc123:")
 *
 * USED IN:
 * - payment-worker: createInvoice() when user initiates payment
 * - webhook-worker: reads webhook payloads shaped like XenditInvoice
 * - renewal-cron: createInvoice() for auto-renewal billing
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Input shape for creating a new Xendit invoice */
export interface CreateInvoiceInput {
  /** Your internal order/invoice ID — must be unique per request */
  external_id: string;

  /** Amount in the smallest unit of the currency (e.g. IDR uses full integers: 99000 = Rp 99.000) */
  amount: number;

  /** Email of the person paying — Xendit will send them the invoice link */
  payer_email?: string;

  /** Human-readable description shown on the invoice page */
  description?: string;

  /** Currency code (default: "IDR"). Xendit supports IDR, PHP, USD, etc. */
  currency?: string;

  /** How many seconds before the invoice expires (default: 86400 = 24 hours) */
  invoice_duration?: number;

  /** URL to redirect to after successful payment */
  success_redirect_url?: string;

  /** URL to redirect to if user cancels or payment fails */
  failure_redirect_url?: string;
}

/** What Xendit returns after creating an invoice */
export interface XenditInvoice {
  id: string;                   // Xendit's internal invoice ID
  external_id: string;          // Your ID (mirrors what you sent)
  status: "PENDING" | "PAID" | "SETTLED" | "EXPIRED";
  amount: number;
  payer_email?: string;
  description?: string;
  currency: string;
  invoice_url: string;          // The payment page URL to redirect the user to
  expiry_date: string;          // ISO 8601 datetime
  created: string;
  updated: string;
}

/** Input shape for creating a Xendit customer */
export interface CreateCustomerInput {
  reference_id: string;         // Your internal user ID
  email?: string;
  given_names?: string;
  mobile_number?: string;
}

/** Xendit API error response shape */
interface XenditErrorResponse {
  error_code: string;
  message: string;
}

// ─── Base Client ──────────────────────────────────────────────────────────────

const XENDIT_BASE_URL = "https://api.xendit.co";

/**
 * Internal base function for all Xendit API calls.
 *
 * Handles:
 * - Authentication (Basic Auth with API key)
 * - JSON serialization/deserialization
 * - Error detection and structured error throwing
 *
 * All public functions in this file call this internally.
 *
 * @param apiKey   - Xendit API key (pass from env.XENDIT_API_KEY)
 * @param method   - HTTP method: "GET" | "POST" | "PATCH" | "DELETE"
 * @param path     - API path, e.g. "/v2/invoices"
 * @param body     - Optional request body (will be JSON-serialized)
 */
async function xenditRequest<T>(
  apiKey: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  // Xendit Basic Auth: base64("apiKey:")
  // The colon is important — password is always empty
  const credentials = btoa(`${apiKey}:`);

  const response = await fetch(`${XENDIT_BASE_URL}${path}`, {
    method,
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Parse response body regardless of status (errors also return JSON)
  const data = await response.json() as T | XenditErrorResponse;

  if (!response.ok) {
    // Xendit returns { error_code, message } for all errors
    const err = data as XenditErrorResponse;
    throw new XenditError(
      err.message ?? "Unknown Xendit error",
      err.error_code ?? "UNKNOWN_ERROR",
      response.status
    );
  }

  return data as T;
}

/**
 * Structured error class for Xendit API failures.
 * Lets callers distinguish Xendit errors from other runtime errors.
 *
 * @example
 * try {
 *   await createInvoice(apiKey, data);
 * } catch (err) {
 *   if (err instanceof XenditError) {
 *     console.error("Xendit rejected:", err.errorCode, err.message);
 *   }
 * }
 */
export class XenditError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly httpStatus: number
  ) {
    super(message);
    this.name = "XenditError";
  }
}

// ─── Invoice API ──────────────────────────────────────────────────────────────

/**
 * Create a new Xendit invoice (payment request).
 *
 * This is the most common operation in the payment flow:
 * 1. User selects a plan → api-gateway calls this
 * 2. Xendit returns an invoice_url → user is redirected to pay
 * 3. After payment → Xendit sends a webhook → webhook-worker processes it
 *
 * @param apiKey - Your Xendit API key (from env.XENDIT_API_KEY)
 * @param data   - Invoice details (see CreateInvoiceInput)
 * @returns The created invoice, including the invoice_url for redirection
 *
 * @example
 * const invoice = await createInvoice(env.XENDIT_API_KEY, {
 *   external_id: generateIdempotencyKey("inv"),
 *   amount: 99000,
 *   payer_email: "alice@example.com",
 *   description: "PayFlow Basic Monthly Plan",
 *   currency: "IDR",
 * });
 *
 * // Redirect user to: invoice.invoice_url
 * // Store in DB: invoice.id as xendit_invoice_id
 */
export async function createInvoice(
  apiKey: string,
  data: CreateInvoiceInput
): Promise<XenditInvoice> {
  return xenditRequest<XenditInvoice>(apiKey, "POST", "/v2/invoices", {
    ...data,
    currency: data.currency ?? "IDR",
    invoice_duration: data.invoice_duration ?? 86400, // 24h default
  });
}

/**
 * Fetch an existing invoice by its Xendit invoice ID.
 * Useful for polling status or syncing after a webhook.
 *
 * @param apiKey    - Your Xendit API key
 * @param invoiceId - The Xendit invoice ID (starts with "inv_")
 */
export async function getInvoice(
  apiKey: string,
  invoiceId: string
): Promise<XenditInvoice> {
  return xenditRequest<XenditInvoice>(apiKey, "GET", `/v2/invoices/${invoiceId}`);
}

/**
 * Expire (cancel) an invoice that hasn't been paid yet.
 * Use this when an order is cancelled or times out on your side.
 *
 * @param apiKey    - Your Xendit API key
 * @param invoiceId - The Xendit invoice ID to expire
 */
export async function expireInvoice(
  apiKey: string,
  invoiceId: string
): Promise<XenditInvoice> {
  return xenditRequest<XenditInvoice>(
    apiKey, "POST", `/invoices/${invoiceId}/expire!`
  );
}

// ─── Customer API ─────────────────────────────────────────────────────────────

/**
 * Create a Xendit customer record.
 * Useful for recurring payments — link a customer to their payment methods.
 *
 * @param apiKey - Your Xendit API key
 * @param data   - Customer details (reference_id = your user's ID)
 */
export async function createCustomer(
  apiKey: string,
  data: CreateCustomerInput
): Promise<{ id: string; reference_id: string; email?: string }> {
  return xenditRequest(apiKey, "POST", "/customers", data);
}
