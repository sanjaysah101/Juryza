import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-SHA256 signing, shared by webhooks and certificates (T4).
 *
 * Webhooks sign each delivery so the receiver can verify it came from us.
 * Certificates sign a canonical record so anyone can re-verify a judge's
 * participation without trusting the display. The signing key is
 * `BETTER_AUTH_SECRET` (already the app's server secret) unless a dedicated
 * `SIGNING_SECRET` is set — one secret to rotate, documented in the threat model.
 */

function key(): string {
  return (
    process.env.SIGNING_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    "dev-only-insecure-secret-change-me"
  );
}

export function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("hex");
}

export function verify(payload: string, signature: string): boolean {
  const expected = sign(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Canonical serialization for a certificate — a stable, sorted-key string so the
 * signature is reproducible regardless of JSON key order.
 */
export function canonicalize(fields: Record<string, string | number>): string {
  return Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("&");
}
