// @ts-nocheck
/**
 * Tests for GET /api/health
 */

import { describe, test, expect } from 'bun:test';
import { app } from '../../app.js';

describe('GET /api/health', () => {
  test('returns 200 with status ok', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('returns a valid ISO timestamp', async () => {
    const res = await app.request('/api/health');
    const body = await res.json();
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });
});
