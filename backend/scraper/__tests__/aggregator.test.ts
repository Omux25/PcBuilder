// @ts-nocheck
import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { aggregate, setSql, resetSql } from '../aggregator.js';
import type { ScrapedPrice } from '../scrapers/baseScraper.js';

// ── Mock SQL factory ──────────────────────────────────────────────────────────

const upsertedRows: ScrapedPrice[] = [];

function makeMockSql() {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    // INSERT values order: component_id, retailer_id, price, in_stock, product_url, NOW()
    upsertedRows.push({
      component_id: values[0] as number,
      retailer_id:  values[1] as number,
      price:        values[2] as number,
      in_stock:     values[3] as boolean,
      product_url:  values[4] as string,
    });
    return Promise.resolve([]);
  };
}

function makeThrowingSql() {
  return (_strings: TemplateStringsArray, ..._values: unknown[]) =>
    Promise.reject(new Error('FK violation'));
}

let throwCount = 0;
function makePartiallyThrowingSql(failOnIndex: number) {
  let callIndex = 0;
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    const i = callIndex++;
    if (i === failOnIndex) {
      return Promise.reject(new Error('FK violation'));
    }
    upsertedRows.push({
      component_id: values[0] as number,
      retailer_id:  values[1] as number,
      price:        values[2] as number,
      in_stock:     values[3] as boolean,
      product_url:  values[4] as string,
    });
    return Promise.resolve([]);
  };
}

// ── Sample data ───────────────────────────────────────────────────────────────

const PRICES: ScrapedPrice[] = [
  { component_id: 1, retailer_id: 1, price: 1299.99, in_stock: true,  product_url: 'https://site1.ma/cpu-1' },
  { component_id: 2, retailer_id: 1, price: 450.00,  in_stock: false, product_url: 'https://site1.ma/gpu-2' },
  { component_id: 3, retailer_id: 2, price: 2499.00, in_stock: true,  product_url: 'https://site2.ma/gpu-3' },
];

beforeEach(() => {
  upsertedRows.length = 0;
  throwCount = 0;
  setSql(makeMockSql());
});

afterAll(() => {
  resetSql();
});

// ── aggregate() — happy path ──────────────────────────────────────────────────

describe('aggregate() — success', () => {
  test('returns updated count equal to number of prices', async () => {
    const result = await aggregate(PRICES);
    expect(result.updated).toBe(3);
    expect(result.errors).toBe(0);
  });

  test('UPSERTs every price record', async () => {
    await aggregate(PRICES);
    expect(upsertedRows).toHaveLength(3);
  });

  test('passes correct values to the SQL query', async () => {
    await aggregate([PRICES[0]]);
    expect(upsertedRows[0].component_id).toBe(1);
    expect(upsertedRows[0].retailer_id).toBe(1);
    expect(upsertedRows[0].price).toBe(1299.99);
    expect(upsertedRows[0].in_stock).toBe(true);
    expect(upsertedRows[0].product_url).toBe('https://site1.ma/cpu-1');
  });

  test('returns updated=0 and errors=0 for empty input', async () => {
    const result = await aggregate([]);
    expect(result.updated).toBe(0);
    expect(result.errors).toBe(0);
    expect(upsertedRows).toHaveLength(0);
  });

  test('handles a single price record', async () => {
    const result = await aggregate([PRICES[0]]);
    expect(result.updated).toBe(1);
    expect(result.errors).toBe(0);
  });
});

// ── aggregate() — error handling ─────────────────────────────────────────────

describe('aggregate() — error handling', () => {
  test('counts errors when all inserts fail', async () => {
    setSql(makeThrowingSql());
    const result = await aggregate(PRICES);
    expect(result.updated).toBe(0);
    expect(result.errors).toBe(3);
  });

  test('does not throw when inserts fail', async () => {
    setSql(makeThrowingSql());
    await expect(aggregate(PRICES)).resolves.toBeDefined();
  });

  test('continues processing after a failed row', async () => {
    // Fail the second row (index 1), succeed the rest
    setSql(makePartiallyThrowingSql(1));
    const result = await aggregate(PRICES);
    expect(result.updated).toBe(2);
    expect(result.errors).toBe(1);
    expect(upsertedRows).toHaveLength(2);
  });

  test('result shape always has updated and errors fields', async () => {
    const result = await aggregate([]);
    expect(result).toHaveProperty('updated');
    expect(result).toHaveProperty('errors');
    expect(typeof result.updated).toBe('number');
    expect(typeof result.errors).toBe('number');
  });
});
