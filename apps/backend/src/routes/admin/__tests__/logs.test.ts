// @ts-nocheck
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { adminLogsRouter } from '../logs.js';
import { setSql, resetSql } from '../../../db/index.js';

const JWT_SECRET = 'test-secret-logs';

function makeApp() {
  process.env.JWT_SECRET = JWT_SECRET;
  const app = new Hono();
  app.route('/api/admin/logs', adminLogsRouter);
  return app;
}

function makeToken() {
  return jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
}

// Mock SQL that returns empty results — no real DB needed
function makeLogsSql() {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    return Promise.resolve([]);
  };
}

// ── Auth guard tests ──────────────────────────────────────────────────────────

describe('GET /api/admin/logs — auth', () => {
  let app: Hono;

  beforeEach(() => { app = makeApp(); setSql(makeLogsSql()); });
  afterEach(() => resetSql());

  test('returns 401 when no token provided', async () => {
    const res = await app.request('/api/admin/logs');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('returns 401 when token is invalid', async () => {
    const res = await app.request('/api/admin/logs', {
      headers: { Authorization: 'Bearer not.a.valid.token' },
    });
    expect(res.status).toBe(401);
  });
});

// ── Validation tests ──────────────────────────────────────────────────────────

describe('GET /api/admin/logs — validation', () => {
  let app: Hono;

  beforeEach(() => { app = makeApp(); setSql(makeLogsSql()); });
  afterEach(() => resetSql());

  test('returns 400 when level is invalid', async () => {
    const res = await app.request('/api/admin/logs?level=DEBUG', {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.fields).toContain('level');
  });

  test('returns 400 when limit is zero', async () => {
    const res = await app.request('/api/admin/logs?limit=0', {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.fields).toContain('limit');
  });

  test('returns 400 when limit is negative', async () => {
    const res = await app.request('/api/admin/logs?limit=-5', {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when limit is not a number', async () => {
    const res = await app.request('/api/admin/logs?limit=abc', {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('accepts valid level values: INFO, WARNING, ERROR', async () => {
    for (const level of ['INFO', 'WARNING', 'ERROR']) {
      const res = await app.request(`/api/admin/logs?level=${level}`, {
        headers: { Authorization: `Bearer ${makeToken()}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('logs');
      expect(Array.isArray(body.logs)).toBe(true);
    }
  });
});

// ── Response shape tests ──────────────────────────────────────────────────────

describe('GET /api/admin/logs — response shape', () => {
  beforeEach(() => setSql(makeLogsSql()));
  afterEach(() => resetSql());

  test('error response has the expected shape', async () => {
    const app = makeApp();
    const res = await app.request('/api/admin/logs?level=INVALID', {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
    expect(body.error).toHaveProperty('fields');
    expect(Array.isArray(body.error.fields)).toBe(true);
  });

  test('success response has logs array and count', async () => {
    const app = makeApp();
    const res = await app.request('/api/admin/logs', {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('logs');
    expect(body).toHaveProperty('count');
    expect(Array.isArray(body.logs)).toBe(true);
    expect(typeof body.count).toBe('number');
  });
});

// ── DELETE /api/admin/logs ────────────────────────────────────────────────────

describe('DELETE /api/admin/logs — auth', () => {
  beforeEach(() => setSql(makeLogsSql()));
  afterEach(() => resetSql());

  test('returns 401 without token', async () => {
    const app = makeApp();
    const res = await app.request('/api/admin/logs?all=true', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/admin/logs — validation', () => {
  beforeEach(() => setSql(makeLogsSql()));
  afterEach(() => resetSql());

  test('returns 400 when neither keep_days nor all is provided', async () => {
    const app = makeApp();
    const res = await app.request('/api/admin/logs', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when keep_days is negative', async () => {
    const app = makeApp();
    const res = await app.request('/api/admin/logs?keep_days=-1', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when keep_days is not a number', async () => {
    const app = makeApp();
    const res = await app.request('/api/admin/logs?keep_days=abc', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    expect(res.status).toBe(400);
  });

  test('returns 200 for valid ?all=true', async () => {
    const app = makeApp();
    const res = await app.request('/api/admin/logs?all=true', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('deleted');
  });

  test('returns 200 for valid ?keep_days=7', async () => {
    const app = makeApp();
    const res = await app.request('/api/admin/logs?keep_days=7', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('deleted');
  });
});
