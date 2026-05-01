// @ts-nocheck
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { adminRetailersRouter } from '../retailers.js';
import { setSql, resetSql } from '../../../services/retailerService.js';

const JWT_SECRET = 'test-secret';

function makeApp() {
  process.env.JWT_SECRET = JWT_SECRET;
  const app = new Hono();
  app.route('/api/admin/retailers', adminRetailersRouter);
  return app;
}

function makeToken() {
  return jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
}

const MOCK_RETAILER = {
  id: 10,
  name: 'UltraPC',
  base_url: 'https://ultrapc.ma',
  country: 'MA',
  is_active: true,
  scraping_interval_hours: 24,
  last_scrape_at: null,
  last_scrape_status: null,
  price_records_count: 0,
};

// adminService.logActivity also calls getSql — we need a multi-call mock
function makeSequentialSql(...rowSets: unknown[][]) {
  let i = 0;
  return async () => rowSets[i] ?? rowSets[rowSets.length - 1];
}

// ── GET /api/admin/retailers ──────────────────────────────────────────────────

describe('GET /api/admin/retailers', () => {
  let app: Hono;
  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 without token', async () => {
    const res = await app.request('/api/admin/retailers');
    expect(res.status).toBe(401);
  });

  test('returns 200 with retailers array', async () => {
    setSql(async () => [MOCK_RETAILER]);

    const res = await app.request('/api/admin/retailers', {
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.retailers)).toBe(true);
    expect(body.retailers[0].name).toBe('UltraPC');
  });

  test('returns empty array when no retailers', async () => {
    setSql(async () => []);

    const res = await app.request('/api/admin/retailers', {
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.retailers).toHaveLength(0);
  });
});

// ── POST /api/admin/retailers ─────────────────────────────────────────────────

describe('POST /api/admin/retailers', () => {
  let app: Hono;
  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 without token', async () => {
    const res = await app.request('/api/admin/retailers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', base_url: 'https://test.ma' }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 400 when name is missing', async () => {
    const res = await app.request('/api/admin/retailers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${makeToken()}` },
      body: JSON.stringify({ base_url: 'https://test.ma' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when base_url is missing', async () => {
    const res = await app.request('/api/admin/retailers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${makeToken()}` },
      body: JSON.stringify({ name: 'Test' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 201 with created retailer', async () => {
    // createRetailer returns the new row; logActivity also calls sql
    let call = 0;
    setSql(async () => { call++; return call === 1 ? [MOCK_RETAILER] : []; });

    const res = await app.request('/api/admin/retailers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${makeToken()}` },
      body: JSON.stringify({ name: 'UltraPC', base_url: 'https://ultrapc.ma' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('UltraPC');
  });
});

// ── PUT /api/admin/retailers/:id ──────────────────────────────────────────────

describe('PUT /api/admin/retailers/:id', () => {
  let app: Hono;
  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 without token', async () => {
    const res = await app.request('/api/admin/retailers/10', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 400 when id is not a number', async () => {
    const res = await app.request('/api/admin/retailers/abc', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${makeToken()}` },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 200 with updated retailer', async () => {
    let call = 0;
    setSql(async () => { call++; return call === 1 ? [{ ...MOCK_RETAILER, name: 'Updated' }] : []; });

    const res = await app.request('/api/admin/retailers/10', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${makeToken()}` },
      body: JSON.stringify({ name: 'Updated' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Updated');
  });

  test('returns 404 when retailer not found', async () => {
    setSql(async () => []);

    const res = await app.request('/api/admin/retailers/9999', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${makeToken()}` },
      body: JSON.stringify({ name: 'Ghost' }),
    });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/admin/retailers/:id ──────────────────────────────────────────

describe('DELETE /api/admin/retailers/:id', () => {
  let app: Hono;
  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 without token', async () => {
    const res = await app.request('/api/admin/retailers/10', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  test('returns 400 when id is not a number', async () => {
    const res = await app.request('/api/admin/retailers/abc', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });
    expect(res.status).toBe(400);
  });

  test('returns 200 when retailer deactivated', async () => {
    let call = 0;
    setSql(async () => { call++; return call === 1 ? [{ ...MOCK_RETAILER, is_active: false }] : []; });

    const res = await app.request('/api/admin/retailers/10', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('10');
  });

  test('returns 404 when retailer not found', async () => {
    setSql(async () => []);

    const res = await app.request('/api/admin/retailers/9999', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(404);
  });
});
