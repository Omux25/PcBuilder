import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { adminTrafficRouter } from '../traffic.routes.js';

describe('adminTrafficRouter', () => {
  it('GET /traffic requires authentication', async () => {
    const app = new Hono();
    app.route('/', adminTrafficRouter);
    const res = await app.request('/traffic?limit=10&offset=0');
    expect(res.status).toBe(401);
  });

  it('DELETE /traffic requires authentication', async () => {
    const app = new Hono();
    app.route('/', adminTrafficRouter);
    const res = await app.request('/traffic', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});
