// @ts-nocheck
/**
 * Unit tests for catalogBuilder.ts — buildFromUnmatched()
 *
 * Tests cover:
 * - Category inference and spec extraction per category
 * - DNA deduplication (existing component matched → mapping created, no new row)
 * - Skipping unrecognized products (accessories, peripherals)
 * - Empty pending list returns early
 * - Slug uniqueness (collision → numeric suffix)
 * - Progress callback invocation
 */

import { describe, test, expect, beforeEach, afterAll, mock } from 'bun:test';

mock.module('../../utils/deepScraper.js', () => {
  return {
    scrapeProductPage: () => Promise.resolve(null)
  };
});
mock.module('../utils/deepScraper.js', () => {
  return {
    scrapeProductPage: () => Promise.resolve(null)
  };
});

import { buildFromUnmatched, setSql, resetSql } from '../catalogBuilder.js';

// ── Mock helpers ──────────────────────────────────────────────────────────────

/**
 * Builds a mock SQL function that captures INSERT calls and returns
 * configurable data for SELECT queries.
 *
 * @param pending   - unmatched_listings rows to return
 * @param catalog   - existing components to return (for DNA dedup check)
 * @param slugs     - existing slugs to return
 */
function makeSql(
  pending: { id: number; retailer_id: number; product_url: string; scraped_name: string }[],
  catalog: { id: number; name: string; brand: string | null; category: string }[] = [],
  slugs: { slug: string }[] = [],
) {
  const insertedComponents: { category: string; name: string; slug: string }[] = [];
  const insertedMappings: { component_id: number }[] = [];
  const updatedListings: { id: number; component_id: number }[] = [];
  let nextId = 100;

  const mock = (strings: any, ...values: unknown[]) => {
    // If called as a tagged template, strings is an array.
    // If called directly (not expected here, but for safety), handle accordingly.
    const query = Array.isArray(strings) ? strings.join('?').trim() : String(strings).trim();

    // SELECT slugs
    if (query.includes('SELECT slug FROM components')) {
      return Promise.resolve(slugs);
    }
    // SELECT catalog components
    if (query.includes('SELECT id, name, brand, category FROM components')) {
      return Promise.resolve(catalog);
    }
    // SELECT pending unmatched listings
    if (query.includes('FROM unmatched_listings') && query.includes('SELECT')) {
      return Promise.resolve(pending);
    }
    // INSERT INTO components
    if (query.includes('INSERT INTO components')) {
      const id = nextId++;
      // Category is a string literal in the SQL template (not a parameter),
      // so extract it from the query string directly.
      const catMatch = query.match(/'(cpu|gpu|ram|storage|motherboard|psu|cooling|case|fan|thermal_paste)'/);
      const category = catMatch ? catMatch[1] : 'unknown';
      insertedComponents.push({ category, name: values[1] as string, slug: values[0] as string });
      return Promise.resolve([{ id }]);
    }
    // INSERT INTO scraper_mappings
    if (query.includes('INSERT INTO scraper_mappings')) {
      insertedMappings.push({ component_id: values[0] as number });
      return Promise.resolve([]);
    }
    // UPDATE unmatched_listings
    if (query.includes('UPDATE unmatched_listings')) {
      updatedListings.push({ id: values[1] as number, component_id: values[0] as number });
      return Promise.resolve([]);
    }
    // scraper_logs
    if (query.includes('scraper_logs')) {
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  };

  return { mock, insertedComponents, insertedMappings, updatedListings };
}

beforeEach(() => { });
afterAll(() => resetSql());

// ── Core behavior ─────────────────────────────────────────────────────────────

describe('buildFromUnmatched — empty input', () => {
  test('returns zero counts when no pending listings', async () => {
    const { mock } = makeSql([]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(0);
  });
});

// ── CPU ───────────────────────────────────────────────────────────────────────

describe('buildFromUnmatched — CPU', () => {
  test('creates a CPU component from a recognizable product name', async () => {
    const { mock, insertedComponents, insertedMappings } = makeSql([
      { id: 1, retailer_id: 11, product_url: 'https://nextlevelpc.ma/cpu/1', scraped_name: 'AMD Ryzen 5 7600X BOX' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
    expect(insertedComponents).toHaveLength(1);
    expect(insertedComponents[0].category).toBe('cpu');
    expect(insertedMappings).toHaveLength(1);
  });

  test('creates an Intel CPU component', async () => {
    const { mock, insertedComponents } = makeSql([
      { id: 2, retailer_id: 10, product_url: 'https://ultrapc.ma/cpu/2', scraped_name: 'Intel Core i7-13700K BOX' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(1);
    expect(insertedComponents[0].category).toBe('cpu');
  });
});

// ── GPU ───────────────────────────────────────────────────────────────────────

describe('buildFromUnmatched — GPU', () => {
  test('creates a GPU component from a recognizable product name', async () => {
    const { mock, insertedComponents } = makeSql([
      { id: 3, retailer_id: 11, product_url: 'https://nextlevelpc.ma/gpu/1', scraped_name: 'Gigabyte GeForce RTX 4090 Gaming OC 24G' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(1);
    expect(insertedComponents[0].category).toBe('gpu');
  });

  test('creates an AMD GPU component', async () => {
    const { mock, insertedComponents } = makeSql([
      { id: 4, retailer_id: 10, product_url: 'https://ultrapc.ma/gpu/2', scraped_name: 'Sapphire Radeon RX 7900 XTX 24GB' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(1);
    expect(insertedComponents[0].category).toBe('gpu');
  });
});

// ── RAM ───────────────────────────────────────────────────────────────────────

describe('buildFromUnmatched — RAM', () => {
  test('creates a RAM component from a DDR5 product name', async () => {
    const { mock, insertedComponents } = makeSql([
      { id: 5, retailer_id: 11, product_url: 'https://nextlevelpc.ma/ram/1', scraped_name: 'Corsair Vengeance 2x16GB DDR5 6000MHz CL30' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(1);
    expect(insertedComponents[0].category).toBe('ram');
  });

  test('creates a RAM component from a DDR4 product name', async () => {
    const { mock, insertedComponents } = makeSql([
      { id: 6, retailer_id: 10, product_url: 'https://ultrapc.ma/ram/1', scraped_name: 'Kingston Fury Beast 16GB DDR4 3200MHz' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(1);
    expect(insertedComponents[0].category).toBe('ram');
  });
});

// ── Storage ───────────────────────────────────────────────────────────────────

describe('buildFromUnmatched — Storage', () => {
  test('creates a storage component from an NVMe product name', async () => {
    const { mock, insertedComponents } = makeSql([
      { id: 7, retailer_id: 11, product_url: 'https://nextlevelpc.ma/ssd/1', scraped_name: 'Samsung 980 Pro 1TB NVMe M.2 PCIe 4.0' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(1);
    expect(insertedComponents[0].category).toBe('storage');
  });
});

// ── Motherboard ───────────────────────────────────────────────────────────────

describe('buildFromUnmatched — Motherboard', () => {
  test('creates a motherboard component from a recognizable chipset name', async () => {
    const { mock, insertedComponents } = makeSql([
      { id: 8, retailer_id: 11, product_url: 'https://nextlevelpc.ma/mb/1', scraped_name: 'MSI MAG B650 TOMAHAWK WIFI DDR5' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(1);
    expect(insertedComponents[0].category).toBe('motherboard');
  });
});

// ── PSU ───────────────────────────────────────────────────────────────────────

describe('buildFromUnmatched — PSU', () => {
  test('creates a PSU component from a recognizable product name', async () => {
    const { mock, insertedComponents } = makeSql([
      { id: 9, retailer_id: 10, product_url: 'https://ultrapc.ma/psu/1', scraped_name: 'Corsair RM850x 850W 80+ Gold Fully Modular' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(1);
    expect(insertedComponents[0].category).toBe('psu');
  });
});

// ── Cooling ───────────────────────────────────────────────────────────────────

describe('buildFromUnmatched — Cooling', () => {
  test('creates an AIO cooling component from a recognizable product name', async () => {
    // Note: avoid model numbers that look like chipsets (e.g. H150i → h150 matches [abxhz]\d{3,4})
    // Use a name where AIO/liquid keyword is unambiguous
    const { mock, insertedComponents } = makeSql([
      { id: 10, retailer_id: 11, product_url: 'https://nextlevelpc.ma/cooling/1', scraped_name: 'Corsair Hydro 360mm AIO Liquid Cooler RGB' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(1);
    expect(insertedComponents[0].category).toBe('cooling');
  });
});

// ── Case ──────────────────────────────────────────────────────────────────────

describe('buildFromUnmatched — Case', () => {
  test('creates a case component from a recognizable product name', async () => {
    const { mock, insertedComponents } = makeSql([
      { id: 11, retailer_id: 10, product_url: 'https://ultrapc.ma/case/1', scraped_name: 'Lian Li O11 Dynamic EVO ATX Mid Tower' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(1);
    expect(insertedComponents[0].category).toBe('case');
  });
});

// ── Skipping ──────────────────────────────────────────────────────────────────

describe('buildFromUnmatched — skipping unrecognized products', () => {
  test('skips accessories (mouse, keyboard, headset)', async () => {
    const { mock, insertedComponents } = makeSql([
      { id: 20, retailer_id: 10, product_url: 'https://ultrapc.ma/acc/1', scraped_name: 'Logitech G502 X Gaming Mouse' },
      { id: 21, retailer_id: 10, product_url: 'https://ultrapc.ma/acc/2', scraped_name: 'HyperX Cloud II Gaming Headset' },
      { id: 22, retailer_id: 10, product_url: 'https://ultrapc.ma/acc/3', scraped_name: 'Câble HDMI 2.1 2m' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(3);
    expect(insertedComponents).toHaveLength(0);
  });

  test('skips laptop RAM (SO-DIMM)', async () => {
    const { mock, insertedComponents } = makeSql([
      { id: 23, retailer_id: 11, product_url: 'https://nextlevelpc.ma/ram/laptop', scraped_name: 'Kingston 16GB SO-DIMM DDR4 3200MHz' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(insertedComponents).toHaveLength(0);
  });

  test('skips bundle products (PC + components)', async () => {
    const { mock, insertedComponents } = makeSql([
      { id: 24, retailer_id: 10, product_url: 'https://ultrapc.ma/bundle/1', scraped_name: 'PC Gamer AMD Ryzen 5 7600X + RTX 4070 + 16GB DDR5' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(insertedComponents).toHaveLength(0);
  });
});

// ── DNA deduplication ─────────────────────────────────────────────────────────

describe('buildFromUnmatched — DNA deduplication', () => {
  test('creates a mapping instead of a new component when DNA match exists in catalog', async () => {
    const existingCatalog = [
      { id: 42, name: 'Ryzen 5 7600X', brand: 'AMD', category: 'cpu' },
    ];
    const { mock, insertedComponents, insertedMappings, updatedListings } = makeSql(
      [{ id: 30, retailer_id: 11, product_url: 'https://nextlevelpc.ma/cpu/1', scraped_name: 'AMD Ryzen 5 7600X BOX' }],
      existingCatalog,
    );
    setSql(mock);

    const result = await buildFromUnmatched();

    // Should create a mapping to the existing component, not a new component row
    expect(result.created).toBe(1);
    expect(insertedComponents).toHaveLength(0);   // no new component inserted
    expect(insertedMappings).toHaveLength(1);      // mapping created
    expect(insertedMappings[0].component_id).toBe(42);
    expect(updatedListings).toHaveLength(1);
  });
});

// ── Mixed batch ───────────────────────────────────────────────────────────────

describe('buildFromUnmatched — mixed batch', () => {
  test('handles a mix of recognizable and unrecognizable products', async () => {
    const { mock, insertedComponents } = makeSql([
      { id: 40, retailer_id: 11, product_url: 'https://nextlevelpc.ma/cpu/1', scraped_name: 'AMD Ryzen 7 7700X BOX' },
      { id: 41, retailer_id: 11, product_url: 'https://nextlevelpc.ma/acc/1', scraped_name: 'Logitech G Pro X Superlight Mouse' },
      { id: 42, retailer_id: 11, product_url: 'https://nextlevelpc.ma/gpu/1', scraped_name: 'MSI GeForce RTX 4070 Ti SUPER Gaming X Trio 16G' },
    ]);
    setSql(mock);

    const result = await buildFromUnmatched();

    expect(result.created).toBe(2);   // CPU + GPU
    expect(result.skipped).toBe(1);   // mouse
    expect(insertedComponents).toHaveLength(2);
  });
});

// ── Progress callback ─────────────────────────────────────────────────────────

describe('buildFromUnmatched — progress callback', () => {
  test('calls onProgress for each listing processed', async () => {
    const { mock } = makeSql([
      { id: 50, retailer_id: 10, product_url: 'https://ultrapc.ma/cpu/1', scraped_name: 'AMD Ryzen 5 7600X' },
      { id: 51, retailer_id: 10, product_url: 'https://ultrapc.ma/acc/1', scraped_name: 'Logitech Mouse' },
    ]);
    setSql(mock);

    const progressCalls: [number, number][] = [];
    await buildFromUnmatched((done, total) => progressCalls.push([done, total]));

    expect(progressCalls).toHaveLength(2);
    expect(progressCalls[0][1]).toBe(2); // total is always 2
    expect(progressCalls[1][0]).toBe(2); // done reaches 2 at the end
  });
});

// ── Slug uniqueness ───────────────────────────────────────────────────────────

describe('buildFromUnmatched — slug uniqueness', () => {
  test('generates a unique slug when the base slug already exists', async () => {
    const existingSlugs = [{ slug: '5-7600x-amd-ryzen' }];
    const { mock, insertedComponents } = makeSql(
      [{ id: 60, retailer_id: 11, product_url: 'https://nextlevelpc.ma/cpu/1', scraped_name: 'AMD Ryzen 5 7600X BOX' }],
      [],
      existingSlugs,
    );
    setSql(mock);

    await buildFromUnmatched();

    expect(insertedComponents).toHaveLength(1);
    // Slug should have a numeric suffix since base slug is taken
    expect(insertedComponents[0].slug).toMatch(/^5-7600x-amd-ryzen-\d+$/);
  });
});
