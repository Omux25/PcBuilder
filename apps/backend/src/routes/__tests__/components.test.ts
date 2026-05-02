// @ts-nocheck
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { componentsRouter } from '../components.js';
import { setSql, resetSql } from '../../db/index.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeApp() {
  const app = new Hono();
  app.route('/api/components', componentsRouter);
  return app;
}

const mockComponent = {
  id: 1,
  name: 'AMD Ryzen 7 7700X',
  brand: 'AMD',
  category: 'cpu',
  socket: 'AM5',
  tdp: 105,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockComponent2 = {
  id: 2,
  name: 'Intel Core i7-13700K',
  brand: 'Intel',
  category: 'cpu',
  socket: 'LGA1700',
  tdp: 125,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// ── GET /api/components ───────────────────────────────────────────────────────

describe('GET /api/components', () => {
  let app: Hono;

  beforeEach(() => {
    app = makeApp();
  });

  afterEach(() => {
    resetSql();
  });

  // getComponents now returns { components, total } — mock must include total_count
  function withCount(rows: unknown[]) {
    return rows.map((r: any) => ({ ...r, total_count: String(rows.length) }));
  }

  test('returns all components when no filters provided', async () => {
    setSql(async () => withCount([mockComponent, mockComponent2]));

    const res = await app.request('/api/components');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.components).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.components[0].id).toBe(1);
    expect(body.components[1].id).toBe(2);
  });

  test('passes category filter to service', async () => {
    setSql(async () => withCount([mockComponent]));

    const res = await app.request('/api/components?category=cpu');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.components).toHaveLength(1);
    expect(body.components[0].category).toBe('cpu');
  });

  test('returns empty array when no components match', async () => {
    setSql(async () => []);

    const res = await app.request('/api/components?category=gpu');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.components).toEqual([]);
    expect(body.total).toBe(0);
  });

  test('returns 200 with array shape', async () => {
    setSql(async () => withCount([mockComponent]));

    const res = await app.request('/api/components');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.components)).toBe(true);
  });
});

// ── GET /api/components/:id ───────────────────────────────────────────────────

describe('GET /api/components/:id', () => {
  let app: Hono;

  beforeEach(() => {
    app = makeApp();
  });

  afterEach(() => {
    resetSql();
  });

  test('returns component when found', async () => {
    setSql(async () => [mockComponent]);

    const res = await app.request('/api/components/1');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.name).toBe('AMD Ryzen 7 7700X');
  });

  test('returns 404 when component not found', async () => {
    setSql(async () => []);

    const res = await app.request('/api/components/999');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe('COMPONENT_NOT_FOUND');
  });

  test('returns 400 when id is not a number', async () => {
    const res = await app.request('/api/components/abc');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when id is zero', async () => {
    const res = await app.request('/api/components/0');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when id is negative', async () => {
    const res = await app.request('/api/components/-1');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('error response has the expected shape', async () => {
    setSql(async () => []);

    const res = await app.request('/api/components/999');
    const body = await res.json();

    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
  });
});
