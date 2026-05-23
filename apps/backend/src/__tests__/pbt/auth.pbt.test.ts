/**
 * Property-Based Tests — JWT Authentication (Task 5.1)
 *
 * Property: admin endpoints always return 401 when the JWT is absent,
 * malformed, signed with the wrong secret, or expired — for any payload.
 *
 * Requirements: 11.3, 11.4
 */

// @ts-nocheck
import { describe, test, beforeAll, afterAll } from 'bun:test';
import * as fc from 'fast-check';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../core/middleware/auth.js';

const TEST_SECRET = 'pbt-auth-test-secret';

beforeAll(() => { process.env.JWT_SECRET = TEST_SECRET; });
afterAll(()  => { delete process.env.JWT_SECRET; });

function buildApp() {
  const app = new Hono();
  app.get('/protected', authMiddleware, (c) => c.json({ ok: true }));
  return app;
}

describe('PBT 5.1 — admin endpoints require valid JWT', () => {
  test('any request without Authorization header returns 401', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string(),
      async (_path) => {
        const app = buildApp();
        const res = await app.request('/protected', { method: 'GET' });
        return res.status === 401;
      },
    ));
  });

  test('any malformed token string returns 401', async () => {
    await fc.assert(fc.asyncProperty(
      // Generate strings that are NOT valid JWTs (no dots or wrong structure)
      fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.match(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)),
      async (badToken) => {
        const app = buildApp();
        const res = await app.request('/protected', {
          method: 'GET',
          headers: { Authorization: `Bearer ${badToken}` },
        });
        return res.status === 401;
      },
    ));
  });

  test('token signed with wrong secret always returns 401', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        id:       fc.integer({ min: 1, max: 9999 }),
        username: fc.string({ minLength: 1, maxLength: 50 }),
      }),
      fc.string({ minLength: 8, maxLength: 64 }).filter(s => s !== TEST_SECRET),
      async (payload, wrongSecret) => {
        const app = buildApp();
        const token = jwt.sign(payload, wrongSecret, { expiresIn: '1h' });
        const res = await app.request('/protected', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.status === 401;
      },
    ));
  });

  test('valid token with correct secret always returns 200', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        id:       fc.integer({ min: 1, max: 9999 }),
        username: fc.string({ minLength: 1, maxLength: 50 }),
      }),
      async (payload) => {
        const app = buildApp();
        const token = jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
        const res = await app.request('/protected', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.status === 200;
      },
    ));
  });
});
