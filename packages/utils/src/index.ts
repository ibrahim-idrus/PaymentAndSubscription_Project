// ─── HMAC ────────────────────────────────────────────────────────────────────

/**
 * Sign a payload with HMAC-SHA256.
 * Uses the Web Crypto API — works in Cloudflare Workers & Node.js 18+.
 */
export async function hmacSign(
  secret: string,
  payload: string
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify a HMAC-SHA256 signature.
 */
export async function hmacVerify(
  secret: string,
  payload: string,
  signature: string
): Promise<boolean> {
  const expected = await hmacSign(secret, payload);
  return timingSafeEqual(expected, signature);
}

// ─── Idempotency ─────────────────────────────────────────────────────────────

/**
 * Generate a deterministic idempotency key from a namespace + unique input.
 * Format: `{namespace}:{sha256(input).slice(0,16)}`
 */
export async function idempotencyKey(
  namespace: string,
  input: string
): Promise<string> {
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  const hashHex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
  return `${namespace}:${hashHex}`;
}

// ─── Timing-safe string comparison ──────────────────────────────────────────

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── Currency helpers ────────────────────────────────────────────────────────

/** Convert cents (integer) to a human-readable amount string. */
export function formatCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}
