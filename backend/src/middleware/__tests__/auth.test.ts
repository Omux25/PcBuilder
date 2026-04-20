/**
 * Unit tests for JWT authentication middleware.
 *
 * Requirements: 11.3, 11.4
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Hono, type Context } from 'hono';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../auth.js';

const TEST_SECRET = 'test-secret-for-auth-middleware';

// Set the JWT_SECRET env var before tests run
beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

afterAll(() => {
  delete process.env.JWT_SECRET;
});

/** Helper: build a minimal Hono app with the auth middleware protecting /protected */
function buildApp() {
  const app = new Hono();

  app.get('/protected', authMiddleware, (c: Context) => {
    const admin = c.get('admin');
    return c.json({ success: true, admin });
  });

  return app;
}

describe('authMiddleware', () => {
  test('returns 401 when Authorization header is missing', async () => {
    const app = buildApp();

    const res = await app.request('/protected', {
      method: 'GET',
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  test('returns 401 when Authorization header has no Bearer prefix', async () => {
    const app = buildApp();

    const res = await app.request('/protected', {
      method: 'GET',
      headers: { Authorization: 'Basic somebase64value' },
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  test('returns 401 when token is malformed', async () => {
    const app = buildApp();

    const res = await app.request('/protected', {
      method: 'GET',
      headers: { Authorization: 'Bearer this.is.not.a.valid.jwt' },
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  test('returns 401 when token is signed with a different secret', async () => {
    const app = buildApp();

    const wrongToken = jwt.sign({ id: 1, username: 'admin' }, 'wrong-secret', {
      expiresIn: '1h',
    });

    const res = await app.request('/protected', {
      method: 'GET',
      headers: { Authorization: `Bearer ${wrongToken}` },
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  test('returns 401 when token is expired', async () => {
    const app = buildApp();

    // Sign a token that expired 1 second ago
    const expiredToken = jwt.sign({ id: 1, username: 'admin' }, TEST_SECRET, {
      expiresIn: -1, // already expired
    });

    const res = await app.request('/protected', {
      method: 'GET',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('UNAUTHORIZED');
    expect(json.error.message).toContain('expired');
  });

  test('calls next() and attaches admin payload to context when token is valid', async () => {
    const app = buildApp();

    const validToken = jwt.sign({ id: 42, username: 'superadmin' }, TEST_SECRET, {
      expiresIn: '1h',
    });

    const res = await app.request('/protected', {
      method: 'GET',
      headers: { Authorization: `Bearer ${validToken}` },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.admin).toBeDefined();
    expect(json.admin.id).toBe(42);
    expect(json.admin.username).toBe('superadmin');
  });

  test('error response has the expected shape', async () => {
    const app = buildApp();

    const res = await app.request('/protected', { method: 'GET' });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toHaveProperty('error');
    expect(json.error).toHaveProperty('code');
    expect(json.error).toHaveProperty('message');
    expect(typeof json.error.code).toBe('string');
    expect(typeof json.error.message).toBe('string');
  });
});
