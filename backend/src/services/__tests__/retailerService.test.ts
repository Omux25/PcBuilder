/**
 * Unit tests for retailerService.ts
 * Injects a mock SQL executor via setSql() so no real DB connection is needed.
 */

// @ts-nocheck — this file runs in Bun (WSL2); bun:test types not available on Windows
import { describe, test, expect, afterAll } from 'bun:test';
import {
  getRetailers,
  getRetailerById,
  createRetailer,
  updateRetailer,
  setSql,
  resetSql,
} from '../retailerService.js';

afterAll(() => resetSql());

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_RETAILERS = [
  {
    id: 10,
    name: 'UltraPC',
    base_url: 'https://ultrapc.ma',
    country: 'MA',
    is_active: true,
    scraping_interval_hours: 24,
    last_scrape_at: '2026-05-01T10:00:00Z',
    last_scrape_status: 'SUCCESS',
    price_records_count: 279,
  },
  {
    id: 11,
    name: 'NextLevel PC',
    base_url: 'https://nextlevel.ma',
    country: 'MA',
    is_active: true,
    scraping_interval_hours: 24,
    last_scrape_at: null,
    last_scrape_status: null,
    price_records_count: 0,
  },
  {
    id: 13,
    name: 'SetupGame',
    base_url: 'https://setupgame.ma',
    country: 'MA',
    is_active: false,
    scraping_interval_hours: 48,
    last_scrape_at: null,
    last_scrape_status: null,
    price_records_count: 0,
  },
];

function makeMockSql(rows: unknown[]) {
  return (_strings: TemplateStringsArray, ..._values: unknown[]) =>
    Promise.resolve(rows);
}

// ── getRetailers ─────────────────────────────────────────────────────────────

describe('getRetailers', () => {
  test('returns all retailers from the mock', async () => {
    setSql(makeMockSql(MOCK_RETAILERS));
    const result = await getRetailers(true);
    expect(result).toHaveLength(3);
  });

  test('each retailer has the expected fields', async () => {
    setSql(makeMockSql(MOCK_RETAILERS));
    const result = await getRetailers(true);
    result.forEach(r => {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('base_url');
      expect(r).toHaveProperty('is_active');
      expect(r).toHaveProperty('price_records_count');
    });
  });

  test('returns empty array when no retailers exist', async () => {
    setSql(makeMockSql([]));
    const result = await getRetailers();
    expect(result).toHaveLength(0);
  });

  test('active-only filter: mock returns only active retailers', async () => {
    const activeOnly = MOCK_RETAILERS.filter(r => r.is_active);
    setSql(makeMockSql(activeOnly));
    const result = await getRetailers(false);
    expect(result).toHaveLength(2);
    result.forEach(r => expect(r.is_active).toBe(true));
  });
});

// ── getRetailerById ──────────────────────────────────────────────────────────

describe('getRetailerById', () => {
  test('returns the retailer when found', async () => {
    setSql(makeMockSql([MOCK_RETAILERS[0]]));
    const result = await getRetailerById(10);
    expect(result.id).toBe(10);
    expect(result.name).toBe('UltraPC');
  });

  test('throws RETAILER_NOT_FOUND when no retailer matches', async () => {
    setSql(makeMockSql([]));
    let thrownError: Error | null = null;
    try {
      await getRetailerById(9999);
    } catch (err) {
      thrownError = err as Error;
    }
    expect(thrownError).not.toBeNull();
    expect((thrownError as any).code).toBe('RETAILER_NOT_FOUND');
    expect(thrownError!.message).toContain('9999');
  });
});

// ── createRetailer ───────────────────────────────────────────────────────────

describe('createRetailer', () => {
  test('returns the created retailer row', async () => {
    const newRetailer = {
      id: 20,
      name: 'NewShop',
      base_url: 'https://newshop.ma',
      country: 'MA',
      is_active: true,
      scraping_interval_hours: 24,
      price_records_count: 0,
    };
    setSql(makeMockSql([newRetailer]));
    const result = await createRetailer({ name: 'NewShop', base_url: 'https://newshop.ma' });
    expect(result.id).toBe(20);
    expect(result.name).toBe('NewShop');
  });
});

// ── updateRetailer ───────────────────────────────────────────────────────────

describe('updateRetailer', () => {
  test('returns the updated retailer row', async () => {
    const updated = { ...MOCK_RETAILERS[0], scraping_interval_hours: 12 };
    setSql(makeMockSql([updated]));
    const result = await updateRetailer(10, { scraping_interval_hours: 12 });
    expect(result.scraping_interval_hours).toBe(12);
  });

  test('throws RETAILER_NOT_FOUND when no retailer matches', async () => {
    setSql(makeMockSql([]));
    let thrownError: Error | null = null;
    try {
      await updateRetailer(9999, { name: 'Ghost' });
    } catch (err) {
      thrownError = err as Error;
    }
    expect(thrownError).not.toBeNull();
    expect((thrownError as any).code).toBe('RETAILER_NOT_FOUND');
  });
});
