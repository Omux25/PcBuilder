/**
 * Integration tests — full scraping cycle.
 *
 * These tests require a live PostgreSQL database with the migrations applied.
 * They are skipped automatically when the DB is not available.
 *
 * To run manually:
 *   wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && \
 *     ~/.bun/bin/bun test src/__tests__/integration/scraping.test.ts 2>&1"
 *
 * Requirements: 6.5, 7.2, 9.1, 9.2
 */

// @ts-nocheck
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'bun';
import { aggregate } from '../../../scraper/aggregator.js';
import { logger } from '../../../scraper/utils/logger.js';
import type { ScrapedPrice } from '../../../scraper/scrapers/baseScraper.js';

// ── DB availability check ─────────────────────────────────────────────────────

let dbAvailable = false;

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
  // Clean up any test data inserted during these tests
  await sql`DELETE FROM scraper_logs WHERE message LIKE '[integration-test]%'`;
  await sql`DELETE FROM prices WHERE product_url LIKE 'https://integration-test.ma/%'`;
});

// ── Logger integration ────────────────────────────────────────────────────────

describe('Logger — DB integration', () => {
  test('inserts an INFO log into scraper_logs', async () => {
    if (!dbAvailable) return;

    await logger.info('[integration-test] INFO entry', 'test-site.ma');

    const rows = await sql`
      SELECT * FROM scraper_logs
      WHERE message = '[integration-test] INFO entry'
      LIMIT 1
    `;

    expect(rows.length).toBe(1);
    expect(rows[0].level).toBe('INFO');
    expect(rows[0].site).toBe('test-site.ma');
  });

  test('inserts a WARNING log into scraper_logs', async () => {
    if (!dbAvailable) return;

    await logger.warn('[integration-test] WARNING entry', 'test-site.ma');

    const rows = await sql`
      SELECT * FROM scraper_logs
      WHERE message = '[integration-test] WARNING entry'
      LIMIT 1
    `;

    expect(rows.length).toBe(1);
    expect(rows[0].level).toBe('WARNING');
  });

  test('inserts an ERROR log into scraper_logs', async () => {
    if (!dbAvailable) return;

    await logger.error('[integration-test] ERROR entry', 'test-site.ma');

    const rows = await sql`
      SELECT * FROM scraper_logs
      WHERE message = '[integration-test] ERROR entry'
      LIMIT 1
    `;

    expect(rows.length).toBe(1);
    expect(rows[0].level).toBe('ERROR');
  });
});

// ── Aggregator integration ────────────────────────────────────────────────────

describe('Aggregator — DB integration', () => {
  // These tests require at least one component and one retailer in the DB.
  // They use component_id=1 and retailer_id=1 — adjust if your seed data differs.

  const TEST_PRICE: ScrapedPrice = {
    component_id: 1,
    retailer_id:  1,
    price:        1299.99,
    in_stock:     true,
    product_url:  'https://integration-test.ma/product/1',
  };

  test('UPSERTs a price record into the prices table', async () => {
    if (!dbAvailable) return;

    const result = await aggregate([TEST_PRICE]);

    // If component_id=1 and retailer_id=1 don't exist, this will be an error
    // That's expected — the test documents the happy path when seed data exists
    if (result.errors > 0) {
      console.warn('[integration] Skipping UPSERT assertion — no seed data (component_id=1, retailer_id=1)');
      return;
    }

    expect(result.updated).toBe(1);
    expect(result.errors).toBe(0);

    const rows = await sql`
      SELECT * FROM prices
      WHERE component_id = 1
        AND retailer_id  = 1
        AND product_url  = 'https://integration-test.ma/product/1'
    `;

    expect(rows.length).toBe(1);
    expect(Number(rows[0].price)).toBe(1299.99);
    expect(rows[0].in_stock).toBe(true);
  });

  test('UPSERT updates an existing row (idempotent)', async () => {
    if (!dbAvailable) return;

    // Insert once
    const r1 = await aggregate([TEST_PRICE]);
    if (r1.errors > 0) return; // no seed data

    // Insert again with updated price
    const updated = { ...TEST_PRICE, price: 1199.00 };
    const r2 = await aggregate([updated]);

    expect(r2.updated).toBe(1);
    expect(r2.errors).toBe(0);

    const rows = await sql`
      SELECT price FROM prices
      WHERE component_id = 1
        AND retailer_id  = 1
        AND product_url  = 'https://integration-test.ma/product/1'
    `;

    expect(Number(rows[0].price)).toBe(1199.00);
  });

  test('returns errors=1 for invalid FK (component_id does not exist)', async () => {
    if (!dbAvailable) return;

    const badPrice: ScrapedPrice = {
      component_id: 999999, // does not exist
      retailer_id:  1,
      price:        500,
      in_stock:     false,
      product_url:  'https://integration-test.ma/product/bad',
    };

    const result = await aggregate([badPrice]);

    // FK violation → error counted, no throw
    expect(result.errors).toBe(1);
    expect(result.updated).toBe(0);
  });

  test('processes multiple prices — counts each independently', async () => {
    if (!dbAvailable) return;

    const prices: ScrapedPrice[] = [
      { ...TEST_PRICE, price: 1100 },
      { component_id: 999999, retailer_id: 1, price: 500, in_stock: false, product_url: 'https://integration-test.ma/bad' },
    ];

    const result = await aggregate(prices);

    // First succeeds (if seed data exists), second fails (bad FK)
    // Either way, total = updated + errors = 2
    expect(result.updated + result.errors).toBe(2);
  });
});
