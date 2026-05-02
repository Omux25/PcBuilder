// @ts-nocheck
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { marketTrendsRouter } from '../marketTrends.js';
import { setSql, resetSql } from '../../db/index.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeApp() {
  const app = new Hono();
  app.route('/api/market-trends', marketTrendsRouter);
  return app;
}

const mockDropRow = {
  component_id: 42,
  price_before: '4500.00',
  price_after:  '3999.00',
  raw_diff:     '-501.00',
  change_pct:   '11.1',
  name:         'RTX 4070 Ti',
  brand:        'NVIDIA',
  slug:         'nvidia-rtx-4070-ti',
  category:     'gpu',
  image_url:    null,
};

const mockHikeRow = {
  component_id: 7,
  price_before: '2000.00',
  price_after:  '2400.00',
  raw_diff:     '400.00',
  change_pct:   '20.0',
  name:         'Ryzen 5 7600X',
  brand:        'AMD',
  slug:         'amd-ryzen-5-7600x',
  category:     'cpu',
  image_url:    null,
};

// ── GET /api/market-trends ────────────────────────────────────────────────────

describe('GET /api/market-trends', () => {
  let app: Hono;

  beforeEach(() => {
    app = makeApp();
  });

  afterEach(() => {
    resetSql();
  });

  // ── Response shape ──────────────────────────────────────────────────────────

  test('returns trends array with correct shape', async () => {
    setSql(async () => [mockDropRow]);

    const res = await app.request('/api/market-trends');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.trends)).toBe(true);
    expect(body.trends).toHaveLength(1);

    const trend = body.trends[0];
    expect(trend.component_id).toBe(42);
    expect(trend.name).toBe('RTX 4070 Ti');
    expect(trend.brand).toBe('NVIDIA');
    expect(trend.slug).toBe('nvidia-rtx-4070-ti');
    expect(trend.category).toBe('gpu');
    expect(trend.image_url).toBeNull();
  });

  test('response includes top-level days, type, and total fields', async () => {
    setSql(async () => [mockDropRow]);

    const res = await app.request('/api/market-trends');
    const body = await res.json();

    expect(typeof body.days).toBe('number');
    expect(typeof body.total).toBe('number');
    expect(typeof body.type).toBe('string');
    expect(body.total).toBe(1);
  });

  test('numeric fields are numbers (not strings from DB)', async () => {
    setSql(async () => [mockDropRow]);

    const res = await app.request('/api/market-trends');
    const body = await res.json();
    const trend = body.trends[0];

    expect(typeof trend.price_before).toBe('number');
    expect(typeof trend.price_after).toBe('number');
    expect(typeof trend.diff_amount).toBe('number');
    expect(typeof trend.change_pct).toBe('number');
  });

  test('diff_amount is always positive (absolute value)', async () => {
    setSql(async () => [mockDropRow]);

    const res = await app.request('/api/market-trends');
    const body = await res.json();

    expect(body.trends[0].diff_amount).toBeGreaterThan(0);
    expect(body.trends[0].diff_amount).toBe(501);
  });

  test('returns empty trends array when no data', async () => {
    setSql(async () => []);

    const res = await app.request('/api/market-trends');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.trends).toEqual([]);
    expect(body.total).toBe(0);
  });

  // ── type param ──────────────────────────────────────────────────────────────

  test('defaults to type=drops', async () => {
    setSql(async () => [mockDropRow]);

    const res = await app.request('/api/market-trends');
    const body = await res.json();

    expect(body.type).toBe('drops');
    expect(body.trends[0].type).toBe('drops');
  });

  test('accepts type=hikes', async () => {
    setSql(async () => [mockHikeRow]);

    const res = await app.request('/api/market-trends?type=hikes');
    const body = await res.json();

    expect(body.type).toBe('hikes');
    expect(body.trends[0].type).toBe('hikes');
  });

  test('unknown type value falls back to drops', async () => {
    setSql(async () => [mockDropRow]);

    const res = await app.request('/api/market-trends?type=invalid');
    const body = await res.json();

    expect(body.type).toBe('drops');
  });

  // ── days param ──────────────────────────────────────────────────────────────

  test('defaults to days=7', async () => {
    setSql(async () => []);

    const res = await app.request('/api/market-trends');
    const body = await res.json();

    expect(body.days).toBe(7);
  });

  test('accepts valid days param', async () => {
    setSql(async () => []);

    const res = await app.request('/api/market-trends?days=14');
    const body = await res.json();

    expect(body.days).toBe(14);
  });

  test('clamps days to max 30', async () => {
    setSql(async () => []);

    const res = await app.request('/api/market-trends?days=999');
    const body = await res.json();

    expect(body.days).toBe(30);
  });

  test('clamps days to min 1', async () => {
    setSql(async () => []);

    const res = await app.request('/api/market-trends?days=0');
    const body = await res.json();

    expect(body.days).toBe(1);
  });

  test('NaN days falls back to default 7', async () => {
    setSql(async () => []);

    const res = await app.request('/api/market-trends?days=abc');
    const body = await res.json();

    expect(body.days).toBe(7);
  });

  // ── limit param ─────────────────────────────────────────────────────────────

  test('NaN limit falls back to default 20', async () => {
    setSql(async () => []);

    const res = await app.request('/api/market-trends?limit=abc');
    const body = await res.json();

    // limit is not echoed in the response, but the request should succeed
    expect(res.status).toBe(200);
  });

  // ── category param ──────────────────────────────────────────────────────────

  test('accepts category filter', async () => {
    setSql(async () => [mockDropRow]);

    const res = await app.request('/api/market-trends?category=gpu');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.trends).toHaveLength(1);
  });

  test('returns 200 with empty trends for unknown category', async () => {
    setSql(async () => []);

    const res = await app.request('/api/market-trends?category=unknown');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.trends).toEqual([]);
  });
});
