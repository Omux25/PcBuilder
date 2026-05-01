// @ts-nocheck
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { adminComponentsRouter } from '../components.js';
import { setSql, resetSql } from '../../../services/componentService.js';

const JWT_SECRET = 'test-secret';

function makeApp() {
  process.env.JWT_SECRET = JWT_SECRET;
  const app = new Hono();
  app.route('/api/admin/components', adminComponentsRouter);
  return app;
}

function makeToken() {
  return jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
}

const validCpuBody = {
  category: 'cpu',
  name: 'AMD Ryzen 7 7700X',
  brand: 'AMD',
  socket: 'AM5',
  tdp: 105,
};

const mockComponent = {
  id: 1,
  ...validCpuBody,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// ── POST /api/admin/components ────────────────────────────────────────────────

describe('POST /api/admin/components', () => {
  let app: Hono;

  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 when no token provided', async () => {
    const res = await app.request('/api/admin/components', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCpuBody),
    });
    expect(res.status).toBe(401);
  });

  test('returns 201 and created component with valid token and body', async () => {
    setSql(async () => [mockComponent]);

    const res = await app.request('/api/admin/components', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${makeToken()}`,
      },
      body: JSON.stringify(validCpuBody),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.name).toBe('AMD Ryzen 7 7700X');
  });

  test('returns 400 when required field is missing', async () => {
    const res = await app.request('/api/admin/components', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${makeToken()}`,
      },
      body: JSON.stringify({ category: 'cpu', name: 'Test' }), // missing socket
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when category is invalid', async () => {
    const res = await app.request('/api/admin/components', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${makeToken()}`,
      },
      body: JSON.stringify({ category: 'keyboard', name: 'Test' }),
    });

    expect(res.status).toBe(400);
  });
});

// ── PUT /api/admin/components/:id ─────────────────────────────────────────────

describe('PUT /api/admin/components/:id', () => {
  let app: Hono;

  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 when no token provided', async () => {
    const res = await app.request('/api/admin/components/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validCpuBody),
    });
    expect(res.status).toBe(401);
  });

  test('returns 200 and updated component', async () => {
    setSql(async () => [{ ...mockComponent, name: 'Updated Name' }]);

    const res = await app.request('/api/admin/components/1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${makeToken()}`,
      },
      body: JSON.stringify({ ...validCpuBody, name: 'Updated Name' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Updated Name');
  });

  test('returns 404 when component not found', async () => {
    setSql(async () => []);

    const res = await app.request('/api/admin/components/999', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${makeToken()}`,
      },
      body: JSON.stringify(validCpuBody),
    });

    expect(res.status).toBe(404);
  });

  test('returns 400 when id is not a number', async () => {
    const res = await app.request('/api/admin/components/abc', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${makeToken()}`,
      },
      body: JSON.stringify(validCpuBody),
    });

    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/admin/components/:id ──────────────────────────────────────────

describe('DELETE /api/admin/components/:id', () => {
  let app: Hono;

  beforeEach(() => { app = makeApp(); });
  afterEach(() => { resetSql(); });

  test('returns 401 when no token provided', async () => {
    const res = await app.request('/api/admin/components/1', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  test('returns 200 with success message when component deleted', async () => {
    // New deleteComponent uses a single CTE — returns the deleted row on success
    let callCount = 0;
    setSql(async () => {
      callCount++;
      if (callCount === 1) return [{ id: 1, price_count: '0', mapping_count: '0' }]; // CTE DELETE success
      return []; // fallback SELECT (not reached on success)
    });

    const res = await app.request('/api/admin/components/1', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBeDefined();
  });

  test('returns 404 when component not found', async () => {
    // New deleteComponent uses a single CTE query — returns [] when component not found
    let callCount = 0;
    setSql(async () => {
      callCount++;
      if (callCount === 1) return []; // CTE DELETE returns nothing — component not found
      return []; // fallback SELECT also returns nothing
    });

    const res = await app.request('/api/admin/components/999', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(404);
  });

  test('returns 400 when id is not a number', async () => {
    const res = await app.request('/api/admin/components/abc', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(400);
  });
});
