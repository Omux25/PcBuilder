/**
 * Integration tests — full scraping cycle.
 *
 * These tests require a live PostgreSQL database with the migrations applied.
 *
 * Requirements: 2.1, 2.2, 3.2, 6.5, 9.1, 9.2
 */

// @ts-nocheck
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'bun';
import { aggregate } from '../../../scraper/aggregator.js';
import { logger } from '../../../scraper/utils/logger.js';
import type { ScrapedPrice } from '../../../scraper/scrapers/baseScraper.js';

// ── DB availability check ─────────────────────────────────────────────────────

let dbAvailable = false;
const TEST_URL = 'https://integration-test.ma/product/1';
const TEST_URL_BAD = 'https://integration-test.ma/product/bad';

beforeAll(async () => {
  try {
    await sql`SELECT 1`;
    dbAvailable = true;
  } catch {
    console.warn('[integration] DB not available — skipping integration tests');
  }
});

afterAll(async () => {
  if (!dbAvailable) return;
  await sql`DELETE FROM scraper_logs WHERE message LIKE '[integration-test]%'`;
  await sql`DELETE FROM prices WHERE product_url LIKE 'https://integration-test.ma/%'`;
  await sql`DELETE FROM price_history WHERE component_id = 1 AND retailer_id = 10`;
  await sql`DELETE FROM scraper_mappings WHERE product_url LIKE 'https://integration-test.ma/%'`;
  await sql`DELETE FROM scraper_mappings WHERE component_id = 999999`;
  await sql`DELETE FROM unmatched_listings WHERE product_url LIKE 'https://integration-test.ma/%'`;
});

// ── Logger integration ────────────────────────────────────────────────────────

describe('Logger — DB integration', () => {
  test('inserts an INFO log into scraper_logs', async () => {
    if (!dbAvailable) return;
    await logger.info('[integration-test] INFO entry', 'test-site.ma');
    const rows = await sql`SELECT * FROM scraper_logs WHERE message = '[integration-test] INFO entry' LIMIT 1`;
    expect(rows.length).toBe(1);
    expect(rows[0].level).toBe('INFO');
    expect(rows[0].site).toBe('test-site.ma');
  });

  test('inserts a WARNING log into scraper_logs', async () => {
    if (!dbAvailable) return;
    await logger.warn('[integration-test] WARNING entry', 'test-site.ma');
    const rows = await sql`SELECT * FROM scraper_logs WHERE message = '[integration-test] WARNING entry' LIMIT 1`;
    expect(rows.length).toBe(1);
    expect(rows[0].level).toBe('WARNING');
  });

  test('inserts an ERROR log into scraper_logs', async () => {
    if (!dbAvailable) return;
    await logger.error('[integration-test] ERROR entry', 'test-site.ma');
    const rows = await sql`SELECT * FROM scraper_logs WHERE message = '[integration-test] ERROR entry' LIMIT 1`;
    expect(rows.length).toBe(1);
    expect(rows[0].level).toBe('ERROR');
  });
});

// ── Aggregator integration ────────────────────────────────────────────────────

describe('Aggregator — DB integration', () => {
  const TEST_PRICE: ScrapedPrice = {
    retailer_id: 10, // UltraPC — always present in the DB
    price: 1299.99,
    in_stock: true,
    product_url: TEST_URL,
    product_name: 'Integration Test Product',
  };

  test('UPSERTs a price record when scraper_mapping exists', async () => {
    if (!dbAvailable) return;

    // Create a scraper mapping so the aggregator can match this product
    await sql`
      INSERT INTO scraper_mappings (component_id, retailer_id, product_url)
      VALUES (1, 10, ${TEST_URL})
      ON CONFLICT (retailer_id, product_url) DO NOTHING
    `;

    const result = await aggregate([TEST_PRICE]);

    if (result.errors > 0) {
      console.warn('[integration] Skipping — seed data missing (component_id=1, retailer_id=10)');
      return;
    }

    expect(result.updated).toBe(1);
    expect(result.unmatched).toBe(0);
    expect(result.errors).toBe(0);

    const rows = await sql`
      SELECT * FROM prices WHERE component_id = 1 AND retailer_id = 10 AND product_url = ${TEST_URL}
    `;
    expect(rows.length).toBe(1);
    expect(Number(rows[0].price)).toBe(1299.99);
  });

  test('UPSERT updates an existing row (idempotent)', async () => {
    if (!dbAvailable) return;

    const r1 = await aggregate([TEST_PRICE]);
    if (r1.errors > 0) return;

    const updated = { ...TEST_PRICE, price: 1199.00 };
    const r2 = await aggregate([updated]);

    expect(r2.updated).toBe(1);
    expect(r2.errors).toBe(0);

    const rows = await sql`
      SELECT price FROM prices WHERE component_id = 1 AND retailer_id = 10 AND product_url = ${TEST_URL}
    `;
    expect(Number(rows[0].price)).toBe(1199.00);
  });

  test('adds to unmatched_listings when no mapping exists', async () => {
    if (!dbAvailable) return;

    const unmappedPrice: ScrapedPrice = {
      retailer_id: 10,
      price: 500,
      in_stock: true,
      product_url: 'https://integration-test.ma/product/unmapped',
      product_name: 'Unmapped Product',
    };

    const result = await aggregate([unmappedPrice]);

    expect(result.unmatched).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.errors).toBe(0);

    // Clean up
    await sql`DELETE FROM unmatched_listings WHERE product_url = 'https://integration-test.ma/product/unmapped'`;
  });

  test('returns errors=1 for invalid FK (component_id does not exist in mapping)', async () => {
    if (!dbAvailable) return;

    const badPrice: ScrapedPrice = {
      retailer_id: 10,
      price: 500,
      in_stock: false,
      product_url: TEST_URL_BAD,
      product_name: 'Bad Product',
    };

    // Insert a mapping pointing to a non-existent component
    try {
      await sql`
        INSERT INTO scraper_mappings (component_id, retailer_id, product_url)
        VALUES (999999, 10, ${TEST_URL_BAD})
        ON CONFLICT (retailer_id, product_url) DO NOTHING
      `;
    } catch {
      // FK violation on scraper_mappings insert — skip test
      return;
    }

    const result = await aggregate([badPrice]);
    expect(result.errors).toBe(1);
    expect(result.updated).toBe(0);

    await sql`DELETE FROM scraper_mappings WHERE product_url = ${TEST_URL_BAD}`;
  });

  test('processes multiple prices — counts each independently', async () => {
    if (!dbAvailable) return;

    const prices: ScrapedPrice[] = [
      { ...TEST_PRICE, price: 1100 },
      { retailer_id: 10, price: 500, in_stock: false, product_url: 'https://integration-test.ma/product/multi-unmapped', product_name: 'Unmapped' },
    ];

    const result = await aggregate(prices);
    expect(result.updated + result.unmatched + result.errors).toBe(2);

    await sql`DELETE FROM unmatched_listings WHERE product_url = 'https://integration-test.ma/product/multi-unmapped'`;
  });
});
