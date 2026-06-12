// @ts-nocheck
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { setSql, resetSql } from '../core/db/index.ts';
import { UnmatchedService } from '../modules/scraping/unmatched/services/unmatchedService.ts';
import { UnmatchedRepository } from '../modules/scraping/unmatched/repositories/unmatchedRepository.ts';

describe('Unmatched Curation Caching and Images', () => {
  let queries: Array<{ query: string; params: unknown[] }> = [];

  const mockSql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    let queryStr = strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? `$` + (i + 1) : ''), '');
    queries.push({ query: queryStr, params: values });
    
    // Return mock values based on the query to satisfy the code path
    if (queryStr.includes('unmatched_listings') && queryStr.includes('SELECT')) {
      return Promise.resolve([
        {
          id: 101,
          retailer_id: 1,
          product_url: 'https://example.com/cpu',
          scraped_name: 'AMD Ryzen 5 5600X',
          scraped_price: 1500.00,
          image_url: 'https://example.com/cpu.png',
          image_urls: ['https://example.com/cpu.png', 'https://example.com/cpu_box.png'],
          canonical_name: 'AMD Ryzen 5 5600X',
          brand: 'AMD',
          category: 'cpu',
          confidence: 'high',
          existing_component_id: null,
          specs_hint: { socket: 'AM4', core_count: 6 }
        }
      ]);
    }
    if (queryStr.includes('components') && queryStr.includes('SELECT')) {
      return Promise.resolve([]); // No duplicate component
    }
    return Promise.resolve([{ id: 42 }]); // Default return ID for inserts
  };

  // Attach transaction begin mock
  mockSql.begin = async (cb: (tx: any) => Promise<any>) => {
    return cb(mockSql);
  };

  mockSql.unsafe = async (query: string, params?: unknown[]) => {
    queries.push({ query, params: params ?? [] });
    return Promise.resolve([]);
  };

  beforeEach(() => {
    queries = [];
    setSql(mockSql as any);
  });

  afterEach(() => {
    resetSql();
  });

  test('UnmatchedService.createAndLink inserts image_url and image_urls', async () => {
    const service = new UnmatchedService();
    const result = await service.createAndLink({
      name: 'AMD Ryzen 5 5600X',
      brand: 'AMD',
      category: 'cpu',
      specs: { socket: 'AM4', core_count: 6 },
      listing_ids: [101]
    });

    expect(result).toBeDefined();
    expect(result.component_id).toBe(42);

    // Look for the INSERT INTO components query
    const insertComponentQuery = queries.find(q => q.query.includes('INSERT INTO components'));
    expect(insertComponentQuery).toBeDefined();
    expect(insertComponentQuery?.query).toContain('image_url');
    expect(insertComponentQuery?.query).toContain('image_urls');

    // Confirm that the listing image URL and array were passed as parameters
    const params = insertComponentQuery?.params || [];
    expect(params).toContain('https://example.com/cpu.png');
    // The serialized string array should be present
    expect(params.some(p => typeof p === 'string' && p.includes('https://example.com/cpu_box.png'))).toBe(true);
  });

  test('UnmatchedRepository.linkListingsToComponent inserts prices immediately', async () => {
    const repo = new UnmatchedRepository();
    await repo.linkListingsToComponent(mockSql as any, [101], 42);

    // Confirm scraper_mappings insert and prices insert
    const insertPricesQuery = queries.find(q => q.query.includes('INSERT INTO prices'));
    expect(insertPricesQuery).toBeDefined();
    expect(insertPricesQuery?.query).toContain('component_id');
    expect(insertPricesQuery?.query).toContain('price');
    expect(insertPricesQuery?.query).toContain('in_stock');
    expect(insertPricesQuery?.params).toContain(42); // component_id
    expect(insertPricesQuery?.params).toContain(1500.00); // scraped_price
  });

  test('UnmatchedRepository.linkListingToComponent inserts price immediately', async () => {
    const repo = new UnmatchedRepository();
    await repo.linkListingToComponent(101, 42);

    const insertPricesQuery = queries.find(q => q.query.includes('INSERT INTO prices'));
    expect(insertPricesQuery).toBeDefined();
    expect(insertPricesQuery?.query).toContain('component_id');
    expect(insertPricesQuery?.query).toContain('price');
    expect(insertPricesQuery?.query).toContain('in_stock');
    expect(insertPricesQuery?.params).toContain(42); // component_id
    expect(insertPricesQuery?.params).toContain(1500.00); // scraped_price
  });
});
