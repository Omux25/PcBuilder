// @ts-nocheck
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { adminUnmatchedRouter } from '../unmatched.js';
import { setSql, resetSql } from '../../../db/index.js';

const JWT_SECRET = 'test-secret';

function makeApp() {
  process.env.JWT_SECRET = JWT_SECRET;
  const app = new Hono();
  app.route('/api/admin/unmatched-listings', adminUnmatchedRouter);
  return app;
}

function makeToken() {
  return jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
}

const MOCK_LISTING = {
  id: 1,
  retailer_id: 10,
  retailer_name: 'UltraPC',
  product_url: 'https://ultrapc.ma/product/123',
  scraped_name: 'AMD Ryzen 5 7600X',
  scraped_price: 1800,
  scraped_at: '2026-05-01T10:00:00Z',
  status: 'pending',
  linked_component_id: null,
};

// ── GET /api/admin/unmatched-listings ─────────────────────────────────────────

describe('GET /api/admin/unmatched-listings', () => {
  let app: Hono;
  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 without token', async () => {
    const res = await app.request('/api/admin/unmatched-listings');
    expect(res.status).toBe(401);
  });

  test('returns 200 with listings array', async () => {
    setSql(async () => [MOCK_LISTING]);

    const res = await app.request('/api/admin/unmatched-listings', {
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.listings)).toBe(true);
    expect(body.listings[0].scraped_name).toBe('AMD Ryzen 5 7600X');
  });

  test('returns empty array when no listings', async () => {
    setSql(async () => []);

    const res = await app.request('/api/admin/unmatched-listings', {
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.listings).toHaveLength(0);
  });
});

// ── POST /api/admin/unmatched-listings/:id/dismiss ────────────────────────────

describe('POST /api/admin/unmatched-listings/:id/dismiss', () => {
  let app: Hono;
  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 without token', async () => {
    const res = await app.request('/api/admin/unmatched-listings/1/dismiss', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  test('returns 400 when id is not a number', async () => {
    const res = await app.request('/api/admin/unmatched-listings/abc/dismiss', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });
    expect(res.status).toBe(400);
  });

  test('returns 200 when listing dismissed', async () => {
    setSql(async () => [{ id: 1 }]);

    const res = await app.request('/api/admin/unmatched-listings/1/dismiss', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('returns 404 when listing not found', async () => {
    setSql(async () => []);

    const res = await app.request('/api/admin/unmatched-listings/9999/dismiss', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(404);
  });
});

// ── POST /api/admin/unmatched-listings/:id/link ───────────────────────────────

describe('POST /api/admin/unmatched-listings/:id/link', () => {
  let app: Hono;
  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 without token', async () => {
    const res = await app.request('/api/admin/unmatched-listings/1/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ component_id: 5 }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 400 when id is not a number', async () => {
    const res = await app.request('/api/admin/unmatched-listings/abc/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${makeToken()}` },
      body: JSON.stringify({ component_id: 5 }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 400 when component_id is missing', async () => {
    const res = await app.request('/api/admin/unmatched-listings/1/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${makeToken()}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 404 when listing not found', async () => {
    setSql(async () => []); // listing lookup returns empty

    const res = await app.request('/api/admin/unmatched-listings/9999/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${makeToken()}` },
      body: JSON.stringify({ component_id: 5 }),
    });

    expect(res.status).toBe(404);
  });

  test('returns 200 with scraper_mapping_id when linked successfully', async () => {
    let call = 0;
    setSql(async () => {
      call++;
      if (call === 1) return [MOCK_LISTING];           // fetch listing
      if (call === 2) return [{ id: 5 }];              // verify component exists
      if (call === 3) return [{ id: 99 }];             // insert scraper_mapping
      return [];                                        // update listing status + logActivity
    });

    const res = await app.request('/api/admin/unmatched-listings/1/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${makeToken()}` },
      body: JSON.stringify({ component_id: 5 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.scraper_mapping_id).toBe(99);
  });
});
