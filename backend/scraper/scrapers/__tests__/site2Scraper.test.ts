// @ts-nocheck
import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { Site2Scraper } from '../site2Scraper.js';
import { setFetch, resetFetchAndLoad } from '../baseScraper.js';

// ── Mock HTML ─────────────────────────────────────────────────────────────────
// Mirrors the selector structure defined in site2Scraper.ts.

function makeProductHtml({
  price,
  stock,
  canonicalUrl = '',
}: {
  price: string;
  stock: string;
  canonicalUrl?: string;
}) {
  return `
    <html>
      <head>
        ${canonicalUrl ? `<link rel="canonical" href="${canonicalUrl}" />` : ''}
      </head>
      <body>
        <div class="price-box">
          <span class="price">${price}</span>
        </div>
        <div class="availability">${stock}</div>
      </body>
    </html>
  `;
}

function makeMockFetch(html: string) {
  return (_url: string) =>
    Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(html) });
}

beforeEach(() => {
  resetFetchAndLoad();
});

afterAll(() => {
  resetFetchAndLoad();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Site2Scraper', () => {
  test('siteName is set correctly', () => {
    const scraper = new Site2Scraper();
    expect(scraper.siteName).toBe('site2.ma');
  });

  test('extracts price from a product page', async () => {
    const html = makeProductHtml({ price: '2 499,00 MAD', stock: 'Disponible' });
    setFetch(makeMockFetch(html));

    const scraper = new Site2Scraper();
    // scrape() a single URL directly to test extractPrices()
    const result = await scraper.scrape('https://site2.ma/produit/gpu-1');

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(2499);
    expect(result[0].retailer_id).toBe(2);
  });

  test('marks product as in_stock when stock text matches', async () => {
    const html = makeProductHtml({ price: '1 299,00 MAD', stock: 'Disponible' });
    setFetch(makeMockFetch(html));

    const scraper = new Site2Scraper();
    const result = await scraper.scrape('https://site2.ma/produit/cpu-1');

    expect(result[0].in_stock).toBe(true);
  });

  test('marks product as out of stock when stock text does not match', async () => {
    const html = makeProductHtml({ price: '1 299,00 MAD', stock: 'Épuisé' });
    setFetch(makeMockFetch(html));

    const scraper = new Site2Scraper();
    const result = await scraper.scrape('https://site2.ma/produit/cpu-1');

    expect(result[0].in_stock).toBe(false);
  });

  test('uses canonical URL from the page when present', async () => {
    const canonical = 'https://site2.ma/produit/canonical-cpu';
    const html = makeProductHtml({ price: '999,00 MAD', stock: 'Disponible', canonicalUrl: canonical });
    setFetch(makeMockFetch(html));

    const scraper = new Site2Scraper();
    const result = await scraper.scrape('https://site2.ma/produit/cpu-1');

    expect(result[0].product_url).toBe(canonical);
  });

  test('returns empty array when price is invalid', async () => {
    const html = makeProductHtml({ price: 'Nous consulter', stock: 'Disponible' });
    setFetch(makeMockFetch(html));

    const scraper = new Site2Scraper();
    const result = await scraper.scrape('https://site2.ma/produit/cpu-1');

    expect(result).toHaveLength(0);
  });

  test('scrapeAllProducts returns empty array when PRODUCT_URLS is empty', async () => {
    // PRODUCT_URLS is empty in the placeholder — no HTTP calls should be made
    const scraper = new Site2Scraper();
    const result = await scraper.scrapeAllProducts();

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  test('throws on HTTP error when scraping a single page', async () => {
    setFetch((_url) => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') }));

    const scraper = new Site2Scraper();
    await expect(scraper.scrape('https://site2.ma/produit/missing')).rejects.toThrow('HTTP 404');
  });
});
