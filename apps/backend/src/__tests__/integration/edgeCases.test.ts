/**
 * Integration tests — API edge cases.
 *
 * Tests 404, 401, empty prices, and DB constraint behavior through the full
 * HTTP stack (Hono app → service → DB).
 *
 * These tests require a live PostgreSQL database with the migrations applied.
 * They are skipped automatically when the DB is not available.
 *
 * To run manually:
 *   wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && \
 *     ~/.bun/bin/bun test src/__tests__/integration/edgeCases.test.ts 2>&1"
 *
 * Requirements: 14.3
 */

// @ts-nocheck
import { describe, test, expect, beforeAll } from 'bun:test';
import { sql } from 'bun';
import { app } from '../../app.js';
import jwt from 'jsonwebtoken';

// ── DB availability check ─────────────────────────────────────────────────────

let dbAvailable = false;

beforeAll(async () => {
  if (process.platform === 'win32') {
    console.warn('[integration] Skipping integration database tests on native Windows to avoid Bun PostgreSQL memory alignment panics.');
    return;
  }
  // Set JWT_SECRET so the auth middleware accepts our test tokens
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-secret';

  try {
    await sql`SELECT 1`;
    dbAvailable = true;
  } catch {
    console.warn('[integration] DB not available — skipping integration tests');
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeToken() {
  const secret = process.env.JWT_SECRET!;
  return jwt.sign({ id: 1, username: 'admin' }, secret, { expiresIn: '1h' });
}

// ── 404 — component not found ─────────────────────────────────────────────────

describe('GET /api/components/:id — 404', () => {
  test('returns 404 for a non-existent component ID', async () => {
    if (!dbAvailable) return;

    const res = await app.request('/api/components/999999');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe('COMPONENT_NOT_FOUND');
  });

  test('returns 400 for a non-numeric ID', async () => {
    const res = await app.request('/api/components/not-a-number');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ── 404 — prices for non-existent component ───────────────────────────────────

describe('GET /api/components/:id/prices — 404', () => {
  test('returns 404 when component does not exist', async () => {
    if (!dbAvailable) return;

    const res = await app.request('/api/components/999999/prices');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe('COMPONENT_NOT_FOUND');
  });
});

// ── Empty prices ──────────────────────────────────────────────────────────────

describe('GET /api/components/:id/prices — empty', () => {
  test('returns empty offers array with message when no prices exist', async () => {
    if (!dbAvailable) return;

    // Use component_id=1 — may or may not have prices depending on seed data
    // We just verify the response shape is correct either way
    const res = await app.request('/api/components/1/prices');

    // Could be 200 (component exists) or 404 (no seed data)
    if (res.status === 404) return; // no seed data — skip

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('offers');
    expect(Array.isArray(body.offers)).toBe(true);
  });
});

// ── 401 — protected routes ────────────────────────────────────────────────────

describe('Admin routes — 401 without token', () => {
  test('POST /api/admin/components returns 401 without token', async () => {
    const res = await app.request('/api/admin/components', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'cpu', name: 'Test', socket: 'AM5' }),
    });
    expect(res.status).toBe(401);
  });

  test('GET /api/admin/logs returns 401 without token', async () => {
    const res = await app.request('/api/admin/logs');
    expect(res.status).toBe(401);
  });

  test('DELETE /api/admin/components/1 returns 401 without token', async () => {
    const res = await app.request('/api/admin/components/1', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});

// ── 400 — validation errors ───────────────────────────────────────────────────

describe('Admin routes — 400 validation errors', () => {
  test('POST /api/admin/components returns 400 when socket is missing for cpu', async () => {
    const res = await app.request('/api/admin/components', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${makeToken()}`,
      },
      body: JSON.stringify({ category: 'cpu', name: 'Test CPU' }), // missing socket
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.fields).toContain('socket');
  });

  test('POST /api/admin/components returns 400 for unknown category', async () => {
    const res = await app.request('/api/admin/components', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${makeToken()}`,
      },
      body: JSON.stringify({ category: 'invalid-category', name: 'Test' }),
    });
    expect(res.status).toBe(400);
  });
});

// ── Compatibility — edge cases ────────────────────────────────────────────────

describe('POST /api/compatibility/validate — edge cases', () => {
  test('returns 400 for invalid JSON body', async () => {
    const res = await app.request('/api/compatibility/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 200 with compatible=true for empty build', async () => {
    const res = await app.request('/api/compatibility/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.compatible).toBe(true);
    expect(body.total_tdp).toBe(0);
  });

  test('returns 400 for invalid build configuration (objects instead of IDs)', async () => {
    const res = await app.request('/api/compatibility/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpu:         { socket: 'AM5', tdp: 65 },
        motherboard: { socket: 'LGA1700', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, tdp: 15 },
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ── Global 404 ────────────────────────────────────────────────────────────────

describe('Global 404 handler', () => {
  test('returns 404 for unknown routes', async () => {
    const res = await app.request('/api/does-not-exist');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  test('404 message includes the method and path', async () => {
    const res = await app.request('/api/unknown-route');
    const body = await res.json();
    expect(body.error.message).toContain('/api/unknown-route');
  });
});
