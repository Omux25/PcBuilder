/**
 * Property-Based Tests — Required field validation → HTTP 400 (Task 7.2)
 *
 * Property: for every component category, omitting any required field
 * always produces HTTP 400 with code VALIDATION_ERROR.
 *
 * Requirements: 8.2, 8.3
 */

// @ts-nocheck
import { describe, test, beforeAll, afterAll } from 'bun:test';
import * as fc from 'fast-check';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { adminComponentsRouter } from '../../routes/admin/components.js';

const TEST_SECRET = 'pbt-validation-test-secret';

beforeAll(() => { process.env.JWT_SECRET = TEST_SECRET; });
afterAll(()  => { delete process.env.JWT_SECRET; });

function makeApp() {
  const app = new Hono();
  app.route('/api/admin/components', adminComponentsRouter);
  return app;
}

function makeToken() {
  return jwt.sign({ id: 1, username: 'admin' }, TEST_SECRET, { expiresIn: '1h' });
}

async function postComponent(app: Hono, body: unknown) {
  return app.request('/api/admin/components', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${makeToken()}`,
    },
    body: JSON.stringify(body),
  });
}

describe('PBT 7.2 — required field validation → HTTP 400', () => {
  test('any body with invalid category always returns 400', async () => {
    const validCategories = new Set(['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case']);

    await fc.assert(fc.asyncProperty(
      fc.string().filter(s => !validCategories.has(s)),
      fc.string({ minLength: 1 }),
      async (badCategory, name) => {
        const app = makeApp();
        const res = await postComponent(app, { category: badCategory, name });
        const body = await res.json();
        return res.status === 400 && body.error.code === 'VALIDATION_ERROR';
      },
    ));
  });

  test('cpu without socket always returns 400', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 100 }),
      async (name) => {
        const app = makeApp();
        const res = await postComponent(app, { category: 'cpu', name }); // missing socket
        return res.status === 400;
      },
    ));
  });

  test('motherboard without socket always returns 400', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 100 }),
      async (name) => {
        const app = makeApp();
        const res = await postComponent(app, {
          category: 'motherboard',
          name,
          // missing socket, supported_ram_types, max_ram_frequency
        });
        return res.status === 400;
      },
    ));
  });

  test('gpu without length_mm always returns 400', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 100 }),
      async (name) => {
        const app = makeApp();
        const res = await postComponent(app, { category: 'gpu', name }); // missing length_mm
        return res.status === 400;
      },
    ));
  });

  test('psu without wattage always returns 400', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 100 }),
      async (name) => {
        const app = makeApp();
        const res = await postComponent(app, { category: 'psu', name }); // missing wattage
        return res.status === 400;
      },
    ));
  });

  test('case without max_gpu_length_mm always returns 400', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 100 }),
      async (name) => {
        const app = makeApp();
        const res = await postComponent(app, { category: 'case', name }); // missing max_gpu_length_mm
        return res.status === 400;
      },
    ));
  });

  test('400 response always has the standard error shape', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 100 }),
      async (name) => {
        const app = makeApp();
        const res = await postComponent(app, { category: 'cpu', name }); // missing socket
        const body = await res.json();
        return (
          res.status === 400 &&
          typeof body.error === 'object' &&
          typeof body.error.code === 'string' &&
          typeof body.error.message === 'string' &&
          Array.isArray(body.error.fields)
        );
      },
    ));
  });
});
