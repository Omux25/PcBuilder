// @ts-nocheck
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { presetsRouter } from '../presets.js';
import { setSql, resetSql } from '../../db/index.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeApp() {
  const app = new Hono();
  app.route('/api/builds/presets', presetsRouter);
  return app;
}

const mockPresetRow = {
  id: 1,
  name: 'Budget Gaming Build',
  description: 'A solid entry-level gaming PC',
  use_case: 'gaming',
  total_price_estimate: 8500,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockComponentRow = {
  preset_build_id: 1,
  category: 'cpu',
  id: 10,
  slug: 'amd-ryzen-5-7600x',
  name: 'Ryzen 5 7600X',
  brand: 'AMD',
  image_url: null,
  is_active: true,
};

// The service makes two SQL calls: one for preset rows, one for component rows.
// We track call count to return the right mock for each call.
function makeTwoCallSql(firstResult: unknown[], secondResult: unknown[]) {
  let calls = 0;
  return async () => {
    calls++;
    return calls === 1 ? firstResult : secondResult;
  };
}

// ── GET /api/builds/presets ───────────────────────────────────────────────────

describe('GET /api/builds/presets', () => {
  let app: Hono;

  beforeEach(() => {
    app = makeApp();
  });

  afterEach(() => {
    resetSql();
  });

  test('returns list of presets with components', async () => {
    setSql(makeTwoCallSql([mockPresetRow], [mockComponentRow]));

    const res = await app.request('/api/builds/presets');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.presets)).toBe(true);
    expect(body.presets).toHaveLength(1);
    expect(body.presets[0].id).toBe(1);
    expect(body.presets[0].name).toBe('Budget Gaming Build');
  });

  test('preset has components map keyed by category', async () => {
    setSql(makeTwoCallSql([mockPresetRow], [mockComponentRow]));

    const res = await app.request('/api/builds/presets');
    const body = await res.json();

    expect(body.presets[0].components).toBeDefined();
    expect(body.presets[0].components.cpu).toBeDefined();
    expect(body.presets[0].components.cpu.name).toBe('Ryzen 5 7600X');
  });

  test('preset has incomplete flag', async () => {
    setSql(makeTwoCallSql([mockPresetRow], [mockComponentRow]));

    const res = await app.request('/api/builds/presets');
    const body = await res.json();

    expect(typeof body.presets[0].incomplete).toBe('boolean');
    expect(body.presets[0].incomplete).toBe(false);
  });

  test('incomplete is true when a component is inactive', async () => {
    const inactiveComponent = { ...mockComponentRow, is_active: false };
    setSql(makeTwoCallSql([mockPresetRow], [inactiveComponent]));

    const res = await app.request('/api/builds/presets');
    const body = await res.json();

    expect(body.presets[0].incomplete).toBe(true);
  });

  test('returns empty array when no presets exist', async () => {
    setSql(async () => []);

    const res = await app.request('/api/builds/presets');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.presets).toEqual([]);
  });

  test('passes use_case filter through query param', async () => {
    setSql(makeTwoCallSql([mockPresetRow], [mockComponentRow]));

    const res = await app.request('/api/builds/presets?use_case=gaming');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.presets).toHaveLength(1);
  });
});

// ── GET /api/builds/presets/:id ───────────────────────────────────────────────

describe('GET /api/builds/presets/:id', () => {
  let app: Hono;

  beforeEach(() => {
    app = makeApp();
  });

  afterEach(() => {
    resetSql();
  });

  test('returns a single preset by id', async () => {
    setSql(makeTwoCallSql([mockPresetRow], [mockComponentRow]));

    const res = await app.request('/api/builds/presets/1');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.name).toBe('Budget Gaming Build');
    expect(body.components).toBeDefined();
  });

  test('returns 404 when preset not found', async () => {
    setSql(async () => []);

    const res = await app.request('/api/builds/presets/999');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe('PRESET_NOT_FOUND');
  });

  test('returns 400 when id is not a number', async () => {
    const res = await app.request('/api/builds/presets/abc');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when id is zero', async () => {
    const res = await app.request('/api/builds/presets/0');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when id is negative', async () => {
    const res = await app.request('/api/builds/presets/-5');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('error response has the expected shape', async () => {
    setSql(async () => []);

    const res = await app.request('/api/builds/presets/999');
    const body = await res.json();

    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
  });
});
