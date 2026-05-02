import { describe, expect, test, afterAll } from 'bun:test';
import fc from 'fast-check';
import { recordPriceChange } from '../../services/priceHistoryService.js';
import { setSql, resetSql } from '../../db/index.js';

describe('PBT 13.3 — Price history insertion', () => {
  afterAll(() => {
    resetSql();
  });

  test('For any sequence of price updates, price_history only gains a new row when price actually changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 100, max: 20000 }), { minLength: 1, maxLength: 50 }),
        async (prices) => {
          const mockHistoryTable: { component_id: number; retailer_id: number; price: number; in_stock: boolean }[] = [];

          const mockSql = (_strings: TemplateStringsArray, ...values: any[]) => {
            const query = _strings.join('?').trim();
            if (query.startsWith('SELECT price FROM price_history')) {
              if (mockHistoryTable.length > 0) {
                return Promise.resolve([{ price: mockHistoryTable[mockHistoryTable.length - 1].price }]);
              }
              return Promise.resolve([]);
            } else if (query.startsWith('INSERT INTO price_history')) {
              mockHistoryTable.push({
                component_id: values[0],
                retailer_id: values[1],
                price: values[2],
                in_stock: values[3]
              });
              return Promise.resolve([]);
            }
            return Promise.resolve([]);
          };

          setSql(mockSql);

          const COMPONENT_ID = 1;
          const RETAILER_ID = 1;

          let expectedRows = 0;
          let lastPrice: number | null = null;

          for (const currentPrice of prices) {
            const wasInserted = await recordPriceChange(COMPONENT_ID, RETAILER_ID, currentPrice, true);
            
            if (currentPrice !== lastPrice) {
              expect(wasInserted).toBe(true);
              expectedRows++;
              lastPrice = currentPrice;
            } else {
              expect(wasInserted).toBe(false);
            }
          }

          expect(mockHistoryTable.length).toBe(expectedRows);

          for (let i = 1; i < mockHistoryTable.length; i++) {
            expect(mockHistoryTable[i].price).not.toEqual(mockHistoryTable[i - 1].price);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
