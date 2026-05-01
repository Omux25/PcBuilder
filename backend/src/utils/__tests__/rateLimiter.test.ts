// @ts-nocheck
import { describe, it, expect, beforeEach } from 'bun:test';
import { isRateLimited } from '../rateLimiter.js';

// Each test uses a unique key so the in-memory store doesn't bleed between tests.
// We use a counter to generate unique keys per test.
let keyCounter = 0;
function uniqueKey(): string {
  return `test:rate_limit:${++keyCounter}:${Date.now()}`;
}

describe('isRateLimited', () => {
  it('allows the first request', async () => {
    const limited = await isRateLimited(uniqueKey(), 5, 60);
    expect(limited).toBe(false);
  });

  it('allows requests up to the limit', async () => {
    const key = uniqueKey();
    const limit = 3;
    for (let i = 0; i < limit; i++) {
      const limited = await isRateLimited(key, limit, 60);
      expect(limited).toBe(false);
    }
  });

  it('blocks the request that exceeds the limit', async () => {
    const key = uniqueKey();
    const limit = 3;
    // Exhaust the limit
    for (let i = 0; i < limit; i++) {
      await isRateLimited(key, limit, 60);
    }
    // This one should be blocked
    const limited = await isRateLimited(key, limit, 60);
    expect(limited).toBe(true);
  });

  it('continues blocking after the limit is exceeded', async () => {
    const key = uniqueKey();
    const limit = 2;
    for (let i = 0; i < limit; i++) {
      await isRateLimited(key, limit, 60);
    }
    // Both subsequent calls should be blocked
    expect(await isRateLimited(key, limit, 60)).toBe(true);
    expect(await isRateLimited(key, limit, 60)).toBe(true);
  });

  it('uses separate windows per key', async () => {
    const key1 = uniqueKey();
    const key2 = uniqueKey();
    const limit = 1;

    // Exhaust key1
    await isRateLimited(key1, limit, 60);
    expect(await isRateLimited(key1, limit, 60)).toBe(true);

    // key2 should still be fresh
    expect(await isRateLimited(key2, limit, 60)).toBe(false);
  });

  it('resets after the window expires', async () => {
    const key = uniqueKey();
    const limit = 1;

    // Exhaust the limit with a 1-second window
    await isRateLimited(key, limit, 1);
    expect(await isRateLimited(key, limit, 1)).toBe(true);

    // Wait for the window to expire — 2000ms gives a 1s buffer over the 1s window
    // to avoid flakiness under load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Should be allowed again
    expect(await isRateLimited(key, limit, 1)).toBe(false);
  });

  it('limit of 1 allows exactly one request', async () => {
    const key = uniqueKey();
    expect(await isRateLimited(key, 1, 60)).toBe(false);
    expect(await isRateLimited(key, 1, 60)).toBe(true);
  });

  it('high limit allows many requests before blocking', async () => {
    const key = uniqueKey();
    const limit = 10;
    for (let i = 0; i < limit; i++) {
      expect(await isRateLimited(key, limit, 60)).toBe(false);
    }
    expect(await isRateLimited(key, limit, 60)).toBe(true);
  });
});
