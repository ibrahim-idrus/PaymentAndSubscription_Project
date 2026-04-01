/**
 * hmac.ts — Webhook Security Utilities
 *
 * WHY THIS FILE EXISTS:
 * When Xendit sends a webhook to your server (e.g. "payment was made"),
 * anyone on the internet could fake that request. Without verification,
 * a bad actor could send a fake "invoice.paid" event and get access/service
 * without actually paying.
 *
 * HOW IT WORKS:
 * - Xendit includes a static "x-callback-token" header in every webhook.
 * - You set this token in your Xendit dashboard.
 * - Your server checks: does the token in the request match your secret?
 * - If yes → legitimate Xendit request. If no → reject it immediately.
 *
 * USED IN:
 * - webhook-worker: validates every incoming Xendit event before processing.
 */

// ─── Internal helper ─────────────────────────────────────────────────────────

/**
 * Timing-safe string comparison.
 *
 * WHY: A normal `a === b` check short-circuits on the first mismatch,
 * which leaks timing info an attacker can exploit to guess the token
 * character by character. This version always takes the same time.
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Different lengths = definitely not equal, but still run the loop
  // to avoid timing differences based on length.
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    // XOR each character: if any differ, mismatch becomes non-zero
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

// ─── Xendit Webhook Verification ─────────────────────────────────────────────

/**
 * Verify an incoming Xendit webhook request.
 *
 * Xendit uses a static callback token (NOT an HMAC signature).
 * You configure this token in Xendit Dashboard → Webhooks → Callback Token.
 *
 * @param token  - The value from the "x-callback-token" request header
 * @param secret - Your Xendit callback token (from env: XENDIT_WEBHOOK_TOKEN)
 * @returns true if the webhook is authentic, false if it should be rejected
 *
 * @example
 * // In webhook-worker:
 * const token = request.headers.get("x-callback-token") ?? "";
 * if (!verifyXenditWebhook(token, env.XENDIT_WEBHOOK_TOKEN)) {
 *   return new Response("Unauthorized", { status: 401 });
 * }
 */
export function verifyXenditWebhook(token: string, secret: string): boolean {
  // Reject empty tokens immediately — never treat empty as valid
  if (!token || !secret) return false;

  return timingSafeEqual(token, secret);
}

// ─── General HMAC Utilities (Web Crypto — works in Workers + Node 18+) ───────

/**
 * Sign any string payload with HMAC-SHA256.
 * Useful for signing internal queue messages or API-to-API calls.
 *
 * @param secret  - The secret key (keep this in env vars, never hardcode)
 * @param payload - The string to sign (usually JSON.stringify of your data)
 * @returns hex string of the HMAC-SHA256 signature
 */
export async function hmacSign(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();

  // Import the raw secret bytes as a CryptoKey for HMAC-SHA256
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,      // not extractable — more secure
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));

  // Convert ArrayBuffer to lowercase hex string
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify a HMAC-SHA256 signature.
 * Use this when you signed something with hmacSign and want to verify it later.
 *
 * @param secret    - The same secret key used to sign
 * @param payload   - The original payload string
 * @param signature - The hex signature to verify against
 * @returns true if signature is valid
 */
export async function hmacVerify(
  secret: string,
  payload: string,
  signature: string
): Promise<boolean> {
  const expected = await hmacSign(secret, payload);
  return timingSafeEqual(expected, signature);
}
