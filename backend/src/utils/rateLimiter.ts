/**
 * In-memory rate limiter for sensitive endpoints (e.g. login).
 *
 * Uses a fixed window per key. Resets on server restart — acceptable for
 * a single-process deployment. For multi-process or production Redis-backed
 * rate limiting, replace the store with a Redis client.
 *
 * @param key           Unique key for the rate limit (e.g. "rate_limit:login:127.0.0.1")
 * @param limit         Max requests allowed within the window
 * @param windowSeconds Window duration in seconds
 * @returns true if the caller is rate-limited, false otherwise
 */

interface WindowEntry {
  count: number;
  resetAt: number; // Unix timestamp (ms)
}

const store = new Map<string, WindowEntry>();

/**
 * Removes expired entries from the rate limit store.
 * Runs every 5 minutes to prevent unbounded memory growth under sustained traffic.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

export async function isRateLimited(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    // First request in this window (or window expired)
    store.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return false;
  }

  entry.count++;
  return entry.count > limit;
}
