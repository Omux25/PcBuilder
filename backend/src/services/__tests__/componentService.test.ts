/**
 * Unit tests for componentService.ts
 * Injects a mock SQL executor via setSql() so no real DB connection is needed.
 *
 * Requirements: 1.2, 7.1, 7.3, 11.1
 */

// @ts-nocheck — this file runs in Bun (WSL2); bun:test types not available on Windows
import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import {
  getComponents,
  getComponentById,
  getPricesByComponentId,
  setSql,
  resetSql,
} from '../componentService.js';

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_COMPONENTS = [
  {
    id: 1,
    name: 'AMD Ryzen 9 7950X',
    brand: 'AMD',
    category: 'cpu',
    socket: 'AM5',
    tdp: 170,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'ASUS ROG STRIX B650',
    brand: 'ASUS',
    category: 'motherboard',
    socket: 'AM5',
    supported_ram_types: ['DDR5'],
    max_ram_frequency: 6000,
    tdp: 50,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 3,
    name: 'RTX 4090',
    brand: 'NVIDIA',
    category: 'gpu',
    length_mm: 336,
    tdp: 450,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const MOCK_PRICE_OFFERS_UNSORTED = [
  {
    retailer_name: 'Retailer A',
    price: 1200,
    in_stock: true,
    product_url: 'https://retailer-a.ma/rtx4090',
    last_updated: '2024-06-01T10:00:00Z',
  },
  {
    retailer_name: 'Retailer B',
    price: 1350,
    in_stock: false,
    product_url: 'https://retailer-b.ma/rtx4090',
    last_updated: '2024-06-01T09:00:00Z',
  },
  {
    retailer_name: 'Retailer C',
    price: 1100,
    in_stock: true,
    product_url: 'https://retailer-c.ma/rtx4090',
    last_updated: '2024-06-01T11:00:00Z',
  },
];

// Sorted by price ASC (as the DB ORDER BY would produce)
const MOCK_PRICE_OFFERS_SORTED = [...MOCK_PRICE_OFFERS_UNSORTED].sort(
  (a, b) => a.price - b.price
);

// ── Mock SQL factory ─────────────────────────────────────────────────────────

/**
 * Creates a tagged-template mock that always resolves with `rows`.
 * The function signature matches Bun.sql's tagged-template interface.
 */
function makeMockSql(rows: unknown[]) {
  return (_strings: TemplateStringsArray, ..._values: unknown[]) =>
    Promise.resolve(rows);
}

// Restore real Bun.sql after all tests (no-op in CI without a DB, but good practice)
afterAll(() => {
  resetSql();
});

// ── getComponents ────────────────────────────────────────────────────────────

// Helper: add total_count field that getComponents now expects from the DB
function withCount(rows: unknown[]) {
  return rows.map((r: any) => ({ ...r, total_count: String(rows.length) }));
}

describe('getComponents', () => {
  test('with no filters returns all components', async () => {
    setSql(makeMockSql(withCount(MOCK_COMPONENTS)));
    const result = await getComponents();
    expect(result.components).toHaveLength(3);
    expect(result.total).toBe(3);
    expect(result.components[0].name).toBe('AMD Ryzen 9 7950X');
    expect(result.components[1].name).toBe('ASUS ROG STRIX B650');
    expect(result.components[2].name).toBe('RTX 4090');
  });

  test('with category filter returns only matching components', async () => {
    const cpuOnly = MOCK_COMPONENTS.filter(c => c.category === 'cpu');
    setSql(makeMockSql(withCount(cpuOnly)));

    const result = await getComponents({ category: 'cpu' });
    expect(result.components).toHaveLength(1);
    expect(result.components[0].category).toBe('cpu');
    expect(result.components[0].name).toBe('AMD Ryzen 9 7950X');
  });

  test('with socket filter returns only matching components', async () => {
    const am5Only = MOCK_COMPONENTS.filter(c => c.socket === 'AM5');
    setSql(makeMockSql(withCount(am5Only)));

    const result = await getComponents({ socket: 'AM5' });
    expect(result.components).toHaveLength(2);
    result.components.forEach(c => expect(c.socket).toBe('AM5'));
  });

  test('with ram_type filter returns only matching components', async () => {
    setSql(makeMockSql([]));

    const result = await getComponents({ ram_type: 'DDR5' });
    expect(Array.isArray(result.components)).toBe(true);
    expect(result.components).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  test('with category + socket filters returns matching components', async () => {
    const filtered = MOCK_COMPONENTS.filter(
      c => c.category === 'cpu' && c.socket === 'AM5'
    );
    setSql(makeMockSql(withCount(filtered)));

    const result = await getComponents({ category: 'cpu', socket: 'AM5' });
    expect(result.components).toHaveLength(1);
    expect(result.components[0].category).toBe('cpu');
    expect(result.components[0].socket).toBe('AM5');
  });

  test('returns empty array when no components match', async () => {
    setSql(makeMockSql([]));
    const result = await getComponents({ category: 'storage' });
    expect(result.components).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ── getComponentById ─────────────────────────────────────────────────────────

describe('getComponentById', () => {
  test('returns the component when found', async () => {
    setSql(makeMockSql([MOCK_COMPONENTS[0]]));
    const result = await getComponentById(1);
    expect(result.id).toBe(1);
    expect(result.name).toBe('AMD Ryzen 9 7950X');
    expect(result.category).toBe('cpu');
  });

  test('returns the correct component for a different id', async () => {
    setSql(makeMockSql([MOCK_COMPONENTS[2]]));
    const result = await getComponentById(3);
    expect(result.id).toBe(3);
    expect(result.name).toBe('RTX 4090');
    expect(result.category).toBe('gpu');
  });

  test('throws COMPONENT_NOT_FOUND error when component does not exist', async () => {
    setSql(makeMockSql([]));

    let thrownError: Error | null = null;
    try {
      await getComponentById(9999);
    } catch (err) {
      thrownError = err as Error;
    }

    expect(thrownError).not.toBeNull();
    expect((thrownError as any).code).toBe('COMPONENT_NOT_FOUND');
    expect(thrownError!.message).toContain('9999');
  });
});

// ── getPricesByComponentId ───────────────────────────────────────────────────

describe('getPricesByComponentId', () => {
  test('returns price offers for a component', async () => {
    setSql(makeMockSql(MOCK_PRICE_OFFERS_SORTED));
    const result = await getPricesByComponentId(3);
    expect(result).toHaveLength(3);
  });

  test('price offers are ordered by ascending price', async () => {
    setSql(makeMockSql(MOCK_PRICE_OFFERS_SORTED));
    const result = await getPricesByComponentId(3);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].price).toBeLessThanOrEqual(result[i + 1].price);
    }
  });

  test('each price offer has the expected fields', async () => {
    setSql(makeMockSql(MOCK_PRICE_OFFERS_SORTED));
    const result = await getPricesByComponentId(3);
    result.forEach(offer => {
      expect(offer).toHaveProperty('retailer_name');
      expect(offer).toHaveProperty('price');
      expect(offer).toHaveProperty('in_stock');
      expect(offer).toHaveProperty('product_url');
      expect(offer).toHaveProperty('last_updated');
    });
  });

  test('returns empty array when no prices exist for a component', async () => {
    setSql(makeMockSql([]));
    const result = await getPricesByComponentId(999);
    expect(result).toHaveLength(0);
  });

  test('cheapest offer is first in the list', async () => {
    setSql(makeMockSql(MOCK_PRICE_OFFERS_SORTED));
    const result = await getPricesByComponentId(3);
    // Retailer C has price 1100 — cheapest
    expect(result[0].price).toBe(1100);
    expect(result[0].retailer_name).toBe('Retailer C');
  });
});
