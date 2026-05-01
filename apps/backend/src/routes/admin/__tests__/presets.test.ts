// @ts-nocheck
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { adminPresetsRouter } from '../presets.js';
import { setSql, resetSql } from '../../../db/index.js';

const JWT_SECRET = 'test-secret';

function makeApp() {
  process.env.JWT_SECRET = JWT_SECRET;
  const app = new Hono();
  app.route('/api/admin/presets', adminPresetsRouter);
  return app;
}

function makeToken() {
  return jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
}

const MOCK_PRESET_ROW = {
  id: 1,
  name: 'Budget Gaming Build',
  description: 'Entry-level gaming PC',
  use_case: 'gaming',
  total_price_estimate: 8500,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// presetService uses sql.begin() — mock must expose begin()
function makeMockSql(rowSets: unknown[][]) {
  let i = 0;
  const fn = async () => rowSets[i++] ?? rowSets[rowSets.length - 1] ?? [];
  fn.begin = async (cb) => cb(fn);
  return fn;
}

// ── GET /api/admin/presets ────────────────────────────────────────────────────

describe('GET /api/admin/presets', () => {
  let app: Hono;
  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 without token', async () => {
    const res = await app.request('/api/admin/presets');
    expect(res.status).toBe(401);
  });

  test('returns 200 with presets array', async () => {
    // getPresets: first call = preset rows, second call = component rows
    setSql(makeMockSql([[MOCK_PRESET_ROW], []]));

    const res = await app.request('/api/admin/presets', {
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.presets)).toBe(true);
    expect(body.presets[0].name).toBe('Budget Gaming Build');
  });

  test('returns empty array when no presets', async () => {
    setSql(makeMockSql([[], []]));

    const res = await app.request('/api/admin/presets', {
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.presets).toHaveLength(0);
  });
});

// ── POST /api/admin/presets ───────────────────────────────────────────────────

describe('POST /api/admin/presets', () => {
  let app: Hono;
  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  const validBody = {
    name: 'Budget Gaming Build',
    use_case: 'gaming',
    components: { cpu: 1, gpu: 2 },
  };

  test('returns 401 without token', async () => {
    const res = await app.request('/api/admin/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(401);
  });

  test('returns 400 when name is missing', async () => {
    const res = await app.request('/api/admin/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${makeToken()}` },
      body: JSON.stringify({ use_case: 'gaming', components: {} }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when use_case is invalid', async () => {
    const res = await app.request('/api/admin/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${makeToken()}` },
      body: JSON.stringify({ name: 'Test', use_case: 'invalid', components: {} }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when components is missing', async () => {
    const res = await app.request('/api/admin/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${makeToken()}` },
      body: JSON.stringify({ name: 'Test', use_case: 'gaming' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 201 with created preset', async () => {
    // createPreset calls sql.begin() → INSERT preset → INSERT component links (one per component)
    // then calls getPresetById → SELECT preset → SELECT components
    // then logActivity → INSERT log
    // validBody has 2 components (cpu, gpu) → 2 link inserts inside begin
    let call = 0;
    const fn = async () => {
      call++;
      if (call === 1) return [MOCK_PRESET_ROW];  // INSERT preset (inside begin)
      if (call === 2) return [];                  // INSERT component link cpu (inside begin)
      if (call === 3) return [];                  // INSERT component link gpu (inside begin)
      if (call === 4) return [MOCK_PRESET_ROW];  // getPresetById: SELECT preset
      if (call === 5) return [];                  // getPresetById: SELECT components
      return [];                                  // logActivity
    };
    fn.begin = async (cb) => cb(fn);
    setSql(fn);

    const res = await app.request('/api/admin/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${makeToken()}` },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Budget Gaming Build');
  });
});

// ── DELETE /api/admin/presets/:id ─────────────────────────────────────────────

describe('DELETE /api/admin/presets/:id', () => {
  let app: Hono;
  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 without token', async () => {
    const res = await app.request('/api/admin/presets/1', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  test('returns 400 when id is not a number', async () => {
    const res = await app.request('/api/admin/presets/abc', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });
    expect(res.status).toBe(400);
  });

  test('returns 200 when preset deleted', async () => {
    setSql(makeMockSql([[{ id: 1 }], []])); // DELETE returns row; logActivity returns []

    const res = await app.request('/api/admin/presets/1', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('1');
  });

  test('returns 404 when preset not found', async () => {
    setSql(makeMockSql([[]]));

    const res = await app.request('/api/admin/presets/9999', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(404);
  });
});
