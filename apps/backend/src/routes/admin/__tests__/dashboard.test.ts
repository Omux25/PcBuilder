// @ts-nocheck
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { adminDashboardRouter } from '../dashboard.js';
import { setSql, resetSql } from '../../../db/index.js';

const JWT_SECRET = 'test-secret';

function makeApp() {
  process.env.JWT_SECRET = JWT_SECRET;
  const app = new Hono();
  app.route('/api/admin/dashboard', adminDashboardRouter);
  return app;
}

function makeToken() {
  return jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
}

// Mock SQL that returns sensible defaults for all dashboard queries
function makeDashboardMockSql() {
  let callCount = 0;
  return async () => {
    callCount++;
    // getDashboardStats fires 5 parallel queries, getPriceUpdatesChart fires 1, getRecentActivity fires 1
    switch (callCount) {
      case 1: return [{ category: 'cpu', count: '10' }, { category: 'gpu', count: '5' }]; // component stats
      case 2: return [{ total: '3', active: '2' }]; // retailer stats
      case 3: return [{ total: '150' }]; // price stats
      case 4: return [{ total: '7' }]; // unmatched stats
      case 5: return [{ last_scrape_at: '2026-05-01T10:00:00Z', last_scrape_status: 'SUCCESS' }]; // scrape stats
      case 6: return [{ date: '2026-05-01', count: '42' }]; // price chart
      case 7: return [{ id: 1, admin_id: 1, action: 'component_created', entity_type: 'component', entity_id: 5, details: null, created_at: '2026-05-01T10:00:00Z', admin_username: 'admin' }]; // activity
      default: return [];
    }
  };
}

describe('GET /api/admin/dashboard', () => {
  let app: Hono;

  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 when no token provided', async () => {
    const res = await app.request('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  test('returns 401 when token is invalid', async () => {
    const res = await app.request('/api/admin/dashboard', {
      headers: { 'Authorization': 'Bearer not-a-valid-token' },
    });
    expect(res.status).toBe(401);
  });

  test('returns 200 with stats, chart, and activity when authenticated', async () => {
    setSql(makeDashboardMockSql());

    const res = await app.request('/api/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('stats');
    expect(body).toHaveProperty('price_updates_chart');
    expect(body).toHaveProperty('recent_activity');
  });

  test('stats has expected shape', async () => {
    setSql(makeDashboardMockSql());

    const res = await app.request('/api/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    const body = await res.json();
    expect(body.stats).toHaveProperty('total_components');
    expect(body.stats).toHaveProperty('components_by_category');
    expect(body.stats).toHaveProperty('total_retailers');
    expect(body.stats).toHaveProperty('active_retailers');
    expect(body.stats).toHaveProperty('total_price_records');
    expect(body.stats).toHaveProperty('unmatched_listings_count');
    expect(body.stats).toHaveProperty('last_scrape');
  });

  test('stats.total_components sums all categories', async () => {
    setSql(makeDashboardMockSql());

    const res = await app.request('/api/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    const body = await res.json();
    // cpu=10, gpu=5 → total=15
    expect(body.stats.total_components).toBe(15);
    expect(body.stats.components_by_category.cpu).toBe(10);
    expect(body.stats.components_by_category.gpu).toBe(5);
  });

  test('returns 200 even when stats DB queries fail (Promise.allSettled)', async () => {
    // getDashboardStats uses Promise.allSettled — individual query failures return zeros.
    // getPriceUpdatesChart and getRecentActivity are called after, so they need to succeed.
    let call = 0;
    setSql(async () => {
      call++;
      // First 5 calls are the allSettled stats queries — simulate all failing by returning []
      // Calls 6+ are chart and activity — return valid empty data
      if (call <= 5) throw new Error('DB down');
      return [];
    });

    const res = await app.request('/api/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    // allSettled catches the 5 stat failures; chart/activity return empty arrays → 200
    // Note: if chart/activity also throw, the route returns 500 (not caught by allSettled)
    // This test verifies the allSettled behavior for the stats queries specifically
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.total_components).toBe(0);
    expect(body.stats.total_retailers).toBe(0);
  });
});
