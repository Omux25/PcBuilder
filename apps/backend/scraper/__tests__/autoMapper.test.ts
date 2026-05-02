// @ts-nocheck
import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { autoMap, setSql, resetSql } from '../autoMapper.js';

// ── Mock helpers ──────────────────────────────────────────────────────────────

const CATALOG = [
  { id: 1, name: 'Ryzen 5 7600X',          brand: 'AMD',     category: 'cpu' },
  { id: 2, name: 'GeForce RTX 4090',        brand: 'NVIDIA',  category: 'gpu' },
  { id: 3, name: 'MAG B650 TOMAHAWK WIFI',  brand: 'MSI',     category: 'motherboard' },
  { id: 4, name: 'Vengeance 32GB DDR5-6000',brand: 'Corsair', category: 'ram' },
];

function makeSql(pending: { id: number; retailer_id: number; product_url: string; scraped_name: string }[]) {
  const insertedMappings: unknown[] = [];
  const updatedListings: unknown[] = [];

  const mock = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?');
    if (query.includes('FROM components')) return Promise.resolve(CATALOG);
    if (query.includes('FROM unmatched_listings')) return Promise.resolve(pending);
    if (query.includes('INSERT INTO scraper_mappings')) {
      insertedMappings.push(values);
      return Promise.resolve([]);
    }
    if (query.includes('UPDATE unmatched_listings')) {
      updatedListings.push(values);
      return Promise.resolve([]);
    }
    if (query.includes('scraper_logs')) return Promise.resolve([]);
    return Promise.resolve([]);
  };

  return { mock, insertedMappings, updatedListings };
}

beforeEach(() => {});
afterAll(() => resetSql());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('autoMap', () => {
  test('maps a CPU listing to the correct catalog entry', async () => {
    const { mock, insertedMappings, updatedListings } = makeSql([
      { id: 10, retailer_id: 11, product_url: 'https://nextlevelpc.ma/cpu/ryzen-7600x', scraped_name: 'AMD Ryzen 5 7600X BOX' },
    ]);
    setSql(mock);

    const result = await autoMap();

    expect(result.mapped).toBe(1);
    expect(result.skipped).toBe(0);
    expect(insertedMappings).toHaveLength(1);
    expect(updatedListings).toHaveLength(1);
    // Verify it mapped to component id 1 (Ryzen 5 7600X)
    expect(insertedMappings[0][0]).toBe(1);
  });

  test('maps a GPU listing to the correct catalog entry', async () => {
    const { mock, insertedMappings } = makeSql([
      { id: 11, retailer_id: 10, product_url: 'https://ultrapc.ma/gpu/rtx4090', scraped_name: 'Gigabyte GeForce RTX 4090 Gaming OC 24G' },
    ]);
    setSql(mock);

    const result = await autoMap();

    expect(result.mapped).toBe(1);
    expect(insertedMappings[0][0]).toBe(2); // RTX 4090
  });

  test('maps a motherboard listing to the correct catalog entry', async () => {
    const { mock, insertedMappings } = makeSql([
      { id: 12, retailer_id: 11, product_url: 'https://nextlevelpc.ma/mb/b650', scraped_name: 'MSI MAG B650 TOMAHAWK WIFI DDR5' },
    ]);
    setSql(mock);

    const result = await autoMap();

    expect(result.mapped).toBe(1);
    expect(insertedMappings[0][0]).toBe(3); // B650 TOMAHAWK
  });

  test('skips listings with no confident match (accessories, peripherals)', async () => {
    const { mock, insertedMappings } = makeSql([
      { id: 13, retailer_id: 10, product_url: 'https://ultrapc.ma/acc/mouse', scraped_name: 'Logitech G502 X Gaming Mouse' },
      { id: 14, retailer_id: 10, product_url: 'https://ultrapc.ma/acc/pad', scraped_name: 'SteelSeries QcK Large Mousepad' },
    ]);
    setSql(mock);

    const result = await autoMap();

    expect(result.mapped).toBe(0);
    expect(result.skipped).toBe(2);
    expect(insertedMappings).toHaveLength(0);
  });

  test('returns zero when no pending listings exist', async () => {
    const { mock } = makeSql([]);
    setSql(mock);

    const result = await autoMap();

    expect(result.mapped).toBe(0);
    expect(result.skipped).toBe(0);
  });

  test('handles multiple listings in one call', async () => {
    const { mock, insertedMappings } = makeSql([
      { id: 20, retailer_id: 11, product_url: 'https://nextlevelpc.ma/cpu/1', scraped_name: 'AMD Ryzen 5 7600X Tray' },
      { id: 21, retailer_id: 11, product_url: 'https://nextlevelpc.ma/gpu/1', scraped_name: 'ASUS TUF Gaming GeForce RTX 4090 24GB' },
      { id: 22, retailer_id: 11, product_url: 'https://nextlevelpc.ma/acc/1', scraped_name: 'Câble HDMI 2.1 2m' },
    ]);
    setSql(mock);

    const result = await autoMap();

    expect(result.mapped).toBe(2);   // CPU + GPU
    expect(result.skipped).toBe(1);  // HDMI cable
    expect(insertedMappings).toHaveLength(2);
  });

  test('does not create duplicate mappings (ON CONFLICT DO NOTHING)', async () => {
    const calls: string[] = [];
    const mock = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join('?');
      calls.push(query);
      if (query.includes('FROM components')) return Promise.resolve(CATALOG);
      if (query.includes('FROM unmatched_listings')) return Promise.resolve([
        { id: 30, retailer_id: 10, product_url: 'https://ultrapc.ma/cpu/1', scraped_name: 'AMD Ryzen 5 7600X' },
      ]);
      return Promise.resolve([]);
    };
    setSql(mock);

    // Run twice — second run should still work (ON CONFLICT handles it)
    await autoMap();
    const result = await autoMap();

    // Both runs attempt the insert — DB handles deduplication
    expect(result.mapped).toBe(1);
  });
});
