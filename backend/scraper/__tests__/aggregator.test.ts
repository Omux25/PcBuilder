// @ts-nocheck
import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { aggregate, setSql, resetSql } from '../aggregator.js';
import type { ScrapedPrice } from '../scrapers/baseScraper.js';

// ── Sample data ───────────────────────────────────────────────────────────────

const PRICES: ScrapedPrice[] = [
  { component_id: 1, retailer_id: 1, price: 1299.99, in_stock: true,  product_url: 'https://site1.ma/cpu-1', product_name: 'CPU 1' },
  { component_id: 2, retailer_id: 2, price: 450.00,  in_stock: false, product_url: 'https://site1.ma/gpu-2', product_name: 'GPU 2' },
  { component_id: 3, retailer_id: 3, price: 2499.00, in_stock: true,  product_url: 'https://site2.ma/gpu-3', product_name: 'GPU 3' },
];

// ── Mock SQL helpers ──────────────────────────────────────────────────────────

/**
 * Creates a mock SQL that simulates the new aggregator flow:
 * - scraper_mappings lookup → returns mapping with component_id + category
 * - current prices lookup → returns [] (no existing price)
 * - UPSERT prices
 * - INSERT price_history
 */
function makeMappedSql(componentId: number) {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?');
    if (query.includes('scraper_mappings')) {
      return Promise.resolve([{ component_id: componentId, category: 'cpu' }]);
    }
    if (query.includes('FROM prices')) {
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  };
}

function makeUnmatchedSql() {
  // Returns no mapping for any product URL
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?');
    if (query.includes('scraper_mappings')) {
      return Promise.resolve([]); // no mapping
    }
    return Promise.resolve([]);
  };
}

function makeThrowingSql() {
  return (_strings: TemplateStringsArray, ..._values: unknown[]) =>
    Promise.reject(new Error('FK violation'));
}

beforeEach(() => {
  resetSql();
});

afterAll(() => {
  resetSql();
});

// ── aggregate() — matched products ───────────────────────────────────────────

describe('aggregate() — matched products', () => {
  test('returns updated count equal to number of matched prices', async () => {
    setSql(makeMappedSql(1));
    const result = await aggregate(PRICES);
    expect(result.updated).toBe(3);
    expect(result.errors).toBe(0);
    expect(result.unmatched).toBe(0);
  });

  test('returns updated=0 and errors=0 for empty input', async () => {
    setSql(makeMappedSql(1));
    const result = await aggregate([]);
    expect(result.updated).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.unmatched).toBe(0);
  });

  test('handles a single price record', async () => {
    setSql(makeMappedSql(1));
    const result = await aggregate([PRICES[0]]);
    expect(result.updated).toBe(1);
    expect(result.errors).toBe(0);
  });
});

// ── aggregate() — unmatched products ─────────────────────────────────────────

describe('aggregate() — unmatched products', () => {
  test('counts unmatched when no mapping exists', async () => {
    setSql(makeUnmatchedSql());
    const result = await aggregate(PRICES);
    expect(result.unmatched).toBe(3);
    expect(result.updated).toBe(0);
    expect(result.errors).toBe(0);
  });

  test('does not throw for unmatched products', async () => {
    setSql(makeUnmatchedSql());
    await expect(aggregate(PRICES)).resolves.toBeDefined();
  });
});

// ── aggregate() — error handling ─────────────────────────────────────────────

describe('aggregate() — error handling', () => {
  test('counts errors when SQL throws', async () => {
    setSql(makeThrowingSql());
    const result = await aggregate(PRICES);
    expect(result.updated).toBe(0);
    expect(result.errors).toBe(3);
  });

  test('does not throw when SQL fails', async () => {
    setSql(makeThrowingSql());
    await expect(aggregate(PRICES)).resolves.toBeDefined();
  });

  test('result shape always has updated, unmatched, and errors fields', async () => {
    setSql(makeMappedSql(1));
    const result = await aggregate([]);
    expect(result).toHaveProperty('updated');
    expect(result).toHaveProperty('unmatched');
    expect(result).toHaveProperty('errors');
    expect(typeof result.updated).toBe('number');
    expect(typeof result.unmatched).toBe('number');
    expect(typeof result.errors).toBe('number');
  });
});
