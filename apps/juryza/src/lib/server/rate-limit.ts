import { HttpError } from "@/lib/server/http";

/**
 * A tiny in-process rate limiter (T3 anti-abuse).
 *
 * Fixed-window counter keyed by an arbitrary string (e.g. `vote:<ip>`). In a
 * single-container deployment this is enough to blunt ballot stuffing and
 * comment spam; a multi-instance deployment would move the counter to the
 * `secondaryStorage` (Redis) Better Auth already supports. Documented as such in
 * the threat model.
 *
 * Pinned to `globalThis` so it survives Next's per-module re-instantiation.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = globalThis as typeof globalThis & {
  __juryzaRateBuckets?: Map<string, Bucket>;
};
if (!store.__juryzaRateBuckets) store.__juryzaRateBuckets = new Map();
const buckets = store.__juryzaRateBuckets;

export interface RateResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Consume one unit from `key`'s window. Returns `ok: false` once `limit` is
 * exceeded within `windowMs`. The window resets lazily on the next call after it
 * expires.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    const fresh: Bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return { ok: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }
  existing.count += 1;
  const ok = existing.count <= limit;
  return { ok, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt };
}

/** Consume one unit or throw a 429 the route handler turns into a response. */
export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const r = rateLimit(key, limit, windowMs);
  if (!r.ok) {
    throw new HttpError(429, "Too many requests, slow down", {
      retryAfterSeconds: Math.ceil((r.resetAt - Date.now()) / 1000),
    });
  }
}
