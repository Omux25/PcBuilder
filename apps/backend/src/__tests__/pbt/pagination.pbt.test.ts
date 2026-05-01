import { describe, expect, test, afterAll } from 'bun:test';
import fc from 'fast-check';
import { getComponents } from '../../services/componentService.js';
import { setSql, resetSql } from '../../db/index.js';

describe('PBT 13.2 — Pagination correctness', () => {
  afterAll(() => {
    resetSql();
  });

  test('For any page and limit, pagination correctly calculates limit and offset and X-Total-Count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer(),
        fc.integer(),
        async (page, limit) => {
          let capturedLimit: number | undefined;
          let capturedOffset: number | undefined;

          const TOTAL_ITEMS = 500; // Fake total items in DB

          const mockSql = (_strings: TemplateStringsArray, ...values: any[]) => {
            capturedLimit = values[values.length - 2];
            capturedOffset = values[values.length - 1];

            // If it requests some offset > TOTAL_ITEMS, return empty array
            if (capturedOffset! >= TOTAL_ITEMS) {
              return Promise.resolve([]);
            }

            // Create fake rows up to capturedLimit
            const rowsCount = Math.min(capturedLimit!, TOTAL_ITEMS - capturedOffset!);
            const rows = Array.from({ length: rowsCount }, (_, i) => ({
              id: i,
              name: 'Mock',
              is_active: true,
              total_count: String(TOTAL_ITEMS)
            }));

            return Promise.resolve(rows);
          };

          setSql(mockSql);

          const result = await getComponents({ page, limit });

          const expectedPage = Math.max(1, page);
          const expectedLimit = Math.min(100, Math.max(1, limit));
          const expectedOffset = (expectedPage - 1) * expectedLimit;

          expect(capturedLimit).toBe(expectedLimit);
          expect(capturedOffset).toBe(expectedOffset);
          
          if (expectedOffset >= TOTAL_ITEMS) {
            expect(result.components).toHaveLength(0);
            expect(result.total).toBe(0);
          } else {
            const expectedRowsCount = Math.min(expectedLimit, TOTAL_ITEMS - expectedOffset);
            expect(result.components).toHaveLength(expectedRowsCount);
            expect(result.total).toBe(TOTAL_ITEMS);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
