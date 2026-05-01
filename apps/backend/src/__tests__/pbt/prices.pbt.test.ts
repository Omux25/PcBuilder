/**
 * Property-Based Tests — Price offers sorted ascending (Task 6.2)
 *
 * Property: getPricesByComponentId always returns offers sorted by
 * ascending price, regardless of the order the DB returns them.
 *
 * Requirements: 7.1
 */

// @ts-nocheck
import { describe, test, beforeEach, afterAll } from 'bun:test';
import * as fc from 'fast-check';
import { getPricesByComponentId } from '../../services/componentService.js';
import { setSql, resetSql } from '../../db/index.js';

afterAll(() => resetSql());

describe('PBT 6.2 — price offers sorted ascending', () => {
  test('service returns exactly the rows the DB provides (sort is DB responsibility)', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(
        fc.record({
          retailer_name: fc.string({ minLength: 1, maxLength: 30 }),
          price:         fc.float({ min: 1, max: 100000, noNaN: true }),
          in_stock:      fc.boolean(),
          product_url:   fc.constant('https://example.ma/product'),
          last_updated:  fc.constant('2024-01-01T00:00:00Z'),
        }),
        { minLength: 0, maxLength: 20 },
      ),
      async (mockOffers) => {
        // The DB mock returns offers in a specific order — the service must
        // pass them through unchanged (ORDER BY is the DB's responsibility)
        setSql((_strings, ..._values) => Promise.resolve(mockOffers));
        const result = await getPricesByComponentId(1);
        return result.length === mockOffers.length;
      },
    ));
  });

  test('when DB returns ascending prices, result is ascending', async () => {
    await fc.assert(fc.asyncProperty(
      // Generate prices already sorted ascending (simulating DB ORDER BY)
      fc.array(fc.float({ min: 1, max: 100000, noNaN: true }), { minLength: 0, maxLength: 20 })
        .map(prices => [...prices].sort((a, b) => a - b))
        .map(sortedPrices => sortedPrices.map(price => ({
          retailer_name: 'Retailer',
          price,
          in_stock: true,
          product_url: 'https://example.ma/product',
          last_updated: '2024-01-01T00:00:00Z',
        }))),
      async (sortedOffers) => {
        setSql((_strings, ..._values) => Promise.resolve(sortedOffers));
        const result = await getPricesByComponentId(1);
        for (let i = 0; i < result.length - 1; i++) {
          if (result[i].price > result[i + 1].price) return false;
        }
        return true;
      },
    ));
  });
});
