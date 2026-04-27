// @ts-nocheck
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { pricesRouter } from '../prices.js';
import { setSql, resetSql } from '../../services/componentService.js';

function makeApp() {
  const app = new Hono();
  app.route('/api/components', pricesRouter);
  return app;
}

const mockComponent = {
  id: 1,
  name: 'AMD Ryzen 7 7700X',
  category: 'cpu',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockOffers = [
  {
    retailer_name: 'Retailer A',
    price: 1299.99,
    in_stock: true,
    product_url: 'https://retailer-a.ma/product/1',
    last_updated: '2024-01-01T00:00:00Z',
  },
  {
    retailer_name: 'Retailer B',
    price: 1399.00,
    in_stock: false,
    product_url: 'https://retailer-b.ma/product/1',
    last_updated: '2024-01-01T00:00:00Z',
  },
];

describe('GET /api/components/:id/prices', () => {
  let app: Hono;

  beforeEach(() => {
    app = makeApp();
  });

  afterEach(() => {
    resetSql();
  });

  test('returns price offers when component exists and has prices', async () => {
    let callCount = 0;
    setSql(async () => {
      callCount++;
      // First call: getComponentById, second call: getPricesByComponentId
      return callCount === 1 ? [mockComponent] : mockOffers;
    });

    const res = await app.request('/api/components/1/prices');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.offers).toHaveLength(2);
    expect(body.offers[0].retailer_name).toBe('Retailer A');
    expect(body.offers[0].price).toBe(1299.99);
  });

  test('returns empty array with message when no offers exist', async () => {
    let callCount = 0;
    setSql(async () => {
      callCount++;
      return callCount === 1 ? [mockComponent] : [];
    });

    const res = await app.request('/api/components/1/prices');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.offers).toEqual([]);
    expect(body.message).toBeDefined();
  });

  test('returns 404 when component does not exist', async () => {
    setSql(async () => []);

    const res = await app.request('/api/components/999/prices');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  test('returns 400 when id is not a number', async () => {
    const res = await app.request('/api/components/abc/prices');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when id is zero', async () => {
    const res = await app.request('/api/components/0/prices');
    expect(res.status).toBe(400);
  });

  test('offers include last_updated field', async () => {
    let callCount = 0;
    setSql(async () => {
      callCount++;
      return callCount === 1 ? [mockComponent] : mockOffers;
    });

    const res = await app.request('/api/components/1/prices');
    const body = await res.json();

    expect(body.offers[0].last_updated).toBeDefined();
  });

  test('offers are returned in the order provided by the service (ascending price)', async () => {
    let callCount = 0;
    setSql(async () => {
      callCount++;
      return callCount === 1 ? [mockComponent] : mockOffers;
    });

    const res = await app.request('/api/components/1/prices');
    const body = await res.json();

    expect(body.offers[0].price).toBeLessThanOrEqual(body.offers[1].price);
  });
});
