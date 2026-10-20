/**
 * In-memory fixed-window rate limiter for public (password-free) write
 * endpoints such as contact forms.
 *
 * NOTE: on serverless platforms each instance keeps its own counters, so
 * this is best-effort protection, not a global guarantee. Extracted sites
 * that need stronger guarantees can swap this module for a durable store —
 * the interface stays identical.
 */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  maxBuckets?: number;
}): RateLimiter {
  const { windowMs, max } = options;
  const maxBuckets = options.maxBuckets ?? 5000;
  const buckets = new Map<string, Bucket>();

  function evictIfNeeded(now: number): void {
    if (buckets.size <= maxBuckets) return;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
    // Still too large: drop oldest buckets to bound memory.
    if (buckets.size > maxBuckets) {
      const sorted = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
      for (const [key] of sorted.slice(0, buckets.size - maxBuckets)) {
        buckets.delete(key);
      }
    }
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      evictIfNeeded(now);
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, remaining: max - 1, retryAfterSeconds: 0 };
      }
      bucket.count += 1;
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      if (bucket.count > max) {
        return { ok: false, remaining: 0, retryAfterSeconds };
      }
      return { ok: true, remaining: max - bucket.count, retryAfterSeconds: 0 };
    },
  };
}

/** Best-effort client key from proxy headers; never trusted for identity. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "anonymous";
}
