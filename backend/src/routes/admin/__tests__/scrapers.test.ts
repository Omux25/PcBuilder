// @ts-nocheck
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { adminScrapersRouter } from '../scrapers.js';
import { setSql, resetSql } from '../../../services/retailerService.js';

const JWT_SECRET = 'test-secret';

function makeApp() {
  process.env.JWT_SECRET = JWT_SECRET;
  const app = new Hono();
  app.route('/api/admin/scrapers', adminScrapersRouter);
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
  price_records_count: 0,
};

// ── POST /api/admin/scrapers/run-all ─────────────────────────────────────────

describe('POST /api/admin/scrapers/run-all', () => {
  let app: Hono;
  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 without token', async () => {
    const res = await app.request('/api/admin/scrapers/run-all', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  test('returns 200 and starts session when authenticated', async () => {
    const res = await app.request('/api/admin/scrapers/run-all', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('started');
    expect(body.message).toBeDefined();
  });
});

// ── POST /api/admin/scrapers/:retailerId/run ──────────────────────────────────

describe('POST /api/admin/scrapers/:retailerId/run', () => {
  let app: Hono;
  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 without token', async () => {
    const res = await app.request('/api/admin/scrapers/10/run', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  test('returns 400 when retailerId is not a number', async () => {
    const res = await app.request('/api/admin/scrapers/abc/run', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 404 when retailer does not exist', async () => {
    // getRetailerById returns empty → RETAILER_NOT_FOUND
    setSql(async () => []);

    const res = await app.request('/api/admin/scrapers/9999/run', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(404);
  });

  test('returns 200 and starts targeted session when retailer exists', async () => {
    setSql(async () => [MOCK_RETAILER]);

    const res = await app.request('/api/admin/scrapers/10/run', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('started');
    expect(body.retailer_id).toBe(10);
  });
});
