/**
 * idempotency.ts — Duplicate Request Prevention
 *
 * WHY THIS FILE EXISTS:
 * In payment systems, network errors are common. If a user clicks "Pay" and
 * the response gets lost, the frontend might retry — and you'd accidentally
 * charge them twice. Idempotency keys solve this.
 *
 * HOW IT WORKS:
 * - Every payment/invoice request gets a unique key attached to it.
 * - If you send the same key twice, Xendit returns the SAME response
 *   as the first call instead of creating a duplicate transaction.
 * - This makes retries completely safe.
 *
 * REAL WORLD EXAMPLE:
 * User buys a Pro plan → you generate key "order_1714000000000_a3f9c2"
 * → network fails → you retry with the SAME key → Xendit returns the
 * existing invoice, no duplicate charge.
 *
 * USED IN:
 * - payment-worker: attaches a key to every createInvoice() call
 * - api-gateway: stores the key in the orders table (idempotency_key column)
 */

/**
 * Generate a unique idempotency key.
 *
 * Format: `{prefix}_{timestamp}_{randomHex}`
 * Example: "order_1714000000000_a3f9c2b1"
 *
 * The key is:
 * - Unique: timestamp + cryptographic random value
 * - Traceable: prefix tells you what the key is for
 * - Safe: uses crypto.getRandomValues (not Math.random)
 *
 * @param prefix - Optional label for the key (e.g. "order", "invoice", "refund")
 * @returns A unique string to use as an idempotency key
 *
 * @example
 * // Basic usage
 * const key = generateIdempotencyKey("order");
 * // → "order_1714000000000_a3f9c2b1d4e7f820"
 *
 * // Without prefix
 * const key = generateIdempotencyKey();
 * // → "1714000000000_a3f9c2b1d4e7f820"
 *
 * // In payment flow:
 * const invoice = await createInvoice({
 *   external_id: generateIdempotencyKey("inv"),
 *   amount: 99000,
 *   payer_email: "user@example.com",
 * });
 */
export function generateIdempotencyKey(prefix?: string): string {
  const timestamp = Date.now(); // milliseconds since epoch — always increasing

  // Generate 8 random bytes using the cryptographically secure RNG
  // This is available in both Cloudflare Workers and Node.js 18+
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);

  // Convert bytes to hex string (16 hex chars = 8 bytes)
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return prefix ? `${prefix}_${timestamp}_${randomHex}` : `${timestamp}_${randomHex}`;
}

/**
 * Generate a deterministic idempotency key from a fixed input.
 *
 * Unlike generateIdempotencyKey() which is random every call,
 * this produces the SAME key for the same input every time.
 *
 * Useful when you want to deduplicate based on business logic,
 * e.g. "user X renewing plan Y in billing period Z" should always
 * produce the same key so you can't accidentally create two invoices.
 *
 * @param namespace - A label for the context (e.g. "renewal")
 * @param input     - The unique business identifier (e.g. "userId:planId:periodStart")
 * @returns A stable idempotency key (namespace + SHA-256 hash prefix)
 *
 * @example
 * const key = await deterministicKey("renewal", `${userId}:${planId}:2026-04`);
 * // → "renewal:3f9a2b1c4d5e6f70"
 * // Calling it again with same args returns the same key — safe to retry
 */
export async function deterministicKey(namespace: string, input: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(input));

  const hashHex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16); // first 16 hex chars (8 bytes) — short but collision-resistant enough

  return `${namespace}:${hashHex}`;
}
