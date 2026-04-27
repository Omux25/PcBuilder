// @ts-nocheck
import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import {
  BaseScraper,
  setFetch,
  setLoad,
  resetFetchAndLoad,
  type ScrapedPrice,
} from '../baseScraper.js';
import type { CheerioAPI } from 'cheerio';

// ── Concrete test subclass ────────────────────────────────────────────────────

/**
 * Minimal concrete scraper for testing.
 * extractPrices() returns whatever the test configures via `setExtractResult`.
 */
class TestScraper extends BaseScraper {
  private _result: ScrapedPrice[] = [];

  constructor() {
    super('test-site.ma');
  }

  setExtractResult(prices: ScrapedPrice[]) {
    this._result = prices;
  }

  protected extractPrices(_$: CheerioAPI): ScrapedPrice[] {
    return this._result;
  }
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeMockFetch(html: string, status = 200) {
  return (_url: string) =>
    Promise.resolve({
      ok:     status >= 200 && status < 300,
      status,
      text:   () => Promise.resolve(html),
    });
}

function makeThrowingFetch(message = 'Network error') {
  return (_url: string) => Promise.reject(new Error(message));
}

const MOCK_PRICES: ScrapedPrice[] = [
  { component_id: 1, retailer_id: 1, price: 1299.99, in_stock: true,  product_url: 'https://test-site.ma/product/1' },
  { component_id: 2, retailer_id: 1, price: 450.00,  in_stock: false, product_url: 'https://test-site.ma/product/2' },
];

beforeEach(() => {
  resetFetchAndLoad();
});

afterAll(() => {
  resetFetchAndLoad();
});

// ── Constructor ───────────────────────────────────────────────────────────────

describe('BaseScraper constructor', () => {
  test('stores the site name', () => {
    const scraper = new TestScraper();
    expect(scraper.siteName).toBe('test-site.ma');
  });
});

// ── scrape() — happy path ─────────────────────────────────────────────────────

describe('BaseScraper.scrape() — success', () => {
  test('returns ScrapedPrice[] from extractPrices()', async () => {
    const scraper = new TestScraper();
    scraper.setExtractResult(MOCK_PRICES);
    setFetch(makeMockFetch('<html><body>price page</body></html>'));

    const result = await scraper.scrape('https://test-site.ma/prices');

    expect(result).toHaveLength(2);
    expect(result[0].component_id).toBe(1);
    expect(result[0].price).toBe(1299.99);
    expect(result[0].in_stock).toBe(true);
  });

  test('returns empty array when extractPrices() finds nothing', async () => {
    const scraper = new TestScraper();
    scraper.setExtractResult([]);
    setFetch(makeMockFetch('<html><body>no products</body></html>'));

    const result = await scraper.scrape('https://test-site.ma/prices');

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  test('passes parsed HTML to extractPrices() via cheerio', async () => {
    let receivedHtml = '';

    class CapturingTestScraper extends BaseScraper {
      constructor() { super('capture.ma'); }
      protected extractPrices($: CheerioAPI): ScrapedPrice[] {
        receivedHtml = $.html();
        return [];
      }
    }

    const html = '<html><body><div class="price">1299</div></body></html>';
    setFetch(makeMockFetch(html));

    const scraper = new CapturingTestScraper();
    await scraper.scrape('https://capture.ma/page');

    expect(receivedHtml).toContain('1299');
  });
});

// ── scrape() — HTTP errors ────────────────────────────────────────────────────

describe('BaseScraper.scrape() — HTTP errors', () => {
  test('throws on HTTP 404', async () => {
    const scraper = new TestScraper();
    setFetch(makeMockFetch('Not Found', 404));

    await expect(scraper.scrape('https://test-site.ma/missing')).rejects.toThrow('HTTP 404');
  });

  test('throws on HTTP 429 (rate limited)', async () => {
    const scraper = new TestScraper();
    setFetch(makeMockFetch('Too Many Requests', 429));

    await expect(scraper.scrape('https://test-site.ma/prices')).rejects.toThrow('HTTP 429');
  });

  test('throws on HTTP 500', async () => {
    const scraper = new TestScraper();
    setFetch(makeMockFetch('Internal Server Error', 500));

    await expect(scraper.scrape('https://test-site.ma/prices')).rejects.toThrow('HTTP 500');
  });

  test('error message includes the URL', async () => {
    const scraper = new TestScraper();
    const url = 'https://test-site.ma/specific-page';
    setFetch(makeMockFetch('Not Found', 404));

    let message = '';
    try {
      await scraper.scrape(url);
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).toContain(url);
  });
});

// ── scrape() — network failures ───────────────────────────────────────────────

describe('BaseScraper.scrape() — network failures', () => {
  test('propagates network errors', async () => {
    const scraper = new TestScraper();
    setFetch(makeThrowingFetch('ECONNREFUSED'));

    await expect(scraper.scrape('https://test-site.ma/prices')).rejects.toThrow('ECONNREFUSED');
  });

  test('propagates timeout errors', async () => {
    const scraper = new TestScraper();
    setFetch(makeThrowingFetch('Request timeout'));

    await expect(scraper.scrape('https://test-site.ma/prices')).rejects.toThrow('Request timeout');
  });
});

// ── ScrapedPrice shape ────────────────────────────────────────────────────────

describe('ScrapedPrice shape', () => {
  test('returned prices have all required fields', async () => {
    const scraper = new TestScraper();
    scraper.setExtractResult(MOCK_PRICES);
    setFetch(makeMockFetch('<html></html>'));

    const result = await scraper.scrape('https://test-site.ma/prices');

    result.forEach((p) => {
      expect(typeof p.component_id).toBe('number');
      expect(typeof p.retailer_id).toBe('number');
      expect(typeof p.price).toBe('number');
      expect(typeof p.in_stock).toBe('boolean');
      expect(typeof p.product_url).toBe('string');
    });
  });
});
