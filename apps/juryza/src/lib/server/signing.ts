import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-SHA256 signing for certificates (platform key) and webhooks (per
 * subscription key). The platform key is `SIGNING_SECRET`, falling back to
 * `BETTER_AUTH_SECRET` so a default install has exactly one secret to rotate.
 */

function platformKey(): string {
  return (
    process.env.SIGNING_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    "dev-only-insecure-secret-change-me"
  );
}

export function hmac(payload: string, key = platformKey()): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

export function verifyHmac(payload: string, signature: string, key = platformKey()): boolean {
  const a = Buffer.from(hmac(payload, key));
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Stable sorted-key serialization, so a signature is reproducible. */
export function canonicalize(fields: Record<string, string | number>): string {
  return Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("&");
}
