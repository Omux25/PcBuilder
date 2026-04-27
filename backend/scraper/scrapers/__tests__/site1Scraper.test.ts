// @ts-nocheck
import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { Site1Scraper } from '../site1Scraper.js';
import { setFetch, resetFetchAndLoad } from '../baseScraper.js';

// ── Mock HTML ─────────────────────────────────────────────────────────────────
// Mirrors the selector structure defined in site1Scraper.ts.
// When you update the real selectors, update this HTML too.

function makeListingHtml(cards: Array<{
  componentId: number | null;
  price: string;
  stock: string;
  href: string;
}>) {
  const cardHtml = cards.map(({ componentId, price, stock, href }) => `
    <div class="product-card" ${componentId !== null ? `data-component-id="${componentId}"` : ''}>
      <span class="product-price">${price}</span>
      <span class="stock-status">${stock}</span>
      <a class="product-link" href="${href}">Voir le produit</a>
    </div>
  `).join('');

  return `<html><body>${cardHtml}</body></html>`;
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

describe('Site1Scraper', () => {
  test('siteName is set correctly', () => {
    const scraper = new Site1Scraper();
    expect(scraper.siteName).toBe('site1.ma');
  });

  test('extracts a single product card correctly', async () => {
    const html = makeListingHtml([
      { componentId: 1, price: '1 299,00 MAD', stock: 'En stock', href: '/produit/cpu-1' },
    ]);
    setFetch(makeMockFetch(html));

    const scraper = new Site1Scraper();
    const result = await scraper.scrapeListingPage();

    expect(result).toHaveLength(1);
    expect(result[0].component_id).toBe(1);
    expect(result[0].retailer_id).toBe(1);
    expect(result[0].price).toBe(1299);
    expect(result[0].in_stock).toBe(true);
    expect(result[0].product_url).toContain('/produit/cpu-1');
  });

  test('extracts multiple product cards', async () => {
    const html = makeListingHtml([
      { componentId: 1, price: '1 299,00 MAD', stock: 'En stock',     href: '/produit/cpu-1' },
      { componentId: 2, price: '450,00 MAD',   stock: 'Rupture',      href: '/produit/gpu-2' },
      { componentId: 3, price: '2 499,00 MAD', stock: 'En stock',     href: '/produit/gpu-3' },
    ]);
    setFetch(makeMockFetch(html));

    const scraper = new Site1Scraper();
    const result = await scraper.scrapeListingPage();

    expect(result).toHaveLength(3);
    expect(result[1].in_stock).toBe(false);
    expect(result[2].price).toBe(2499);
  });

  test('skips cards without a component_id attribute', async () => {
    const html = makeListingHtml([
      { componentId: null, price: '999,00 MAD', stock: 'En stock', href: '/produit/unknown' },
      { componentId: 5,    price: '599,00 MAD', stock: 'En stock', href: '/produit/ram-5' },
    ]);
    setFetch(makeMockFetch(html));

    const scraper = new Site1Scraper();
    const result = await scraper.scrapeListingPage();

    expect(result).toHaveLength(1);
    expect(result[0].component_id).toBe(5);
  });

  test('skips cards with invalid price', async () => {
    const html = makeListingHtml([
      { componentId: 1, price: 'Prix sur demande', stock: 'En stock', href: '/produit/cpu-1' },
      { componentId: 2, price: '750,00 MAD',       stock: 'En stock', href: '/produit/ram-2' },
    ]);
    setFetch(makeMockFetch(html));

    const scraper = new Site1Scraper();
    const result = await scraper.scrapeListingPage();

    expect(result).toHaveLength(1);
    expect(result[0].component_id).toBe(2);
  });

  test('returns empty array when page has no product cards', async () => {
    const html = '<html><body><p>Aucun produit trouvé.</p></body></html>';
    setFetch(makeMockFetch(html));

    const scraper = new Site1Scraper();
    const result = await scraper.scrapeListingPage();

    expect(result).toHaveLength(0);
  });

  test('prefixes relative URLs with the site domain', async () => {
    const html = makeListingHtml([
      { componentId: 1, price: '1 299,00 MAD', stock: 'En stock', href: '/produit/cpu-1' },
    ]);
    setFetch(makeMockFetch(html));

    const scraper = new Site1Scraper();
    const result = await scraper.scrapeListingPage();

    expect(result[0].product_url).toBe('https://site1.ma/produit/cpu-1');
  });

  test('keeps absolute URLs as-is', async () => {
    const html = makeListingHtml([
      { componentId: 1, price: '1 299,00 MAD', stock: 'En stock', href: 'https://site1.ma/produit/cpu-1' },
    ]);
    setFetch(makeMockFetch(html));

    const scraper = new Site1Scraper();
    const result = await scraper.scrapeListingPage();

    expect(result[0].product_url).toBe('https://site1.ma/produit/cpu-1');
  });

  test('throws on HTTP error', async () => {
    setFetch((_url) => Promise.resolve({ ok: false, status: 503, text: () => Promise.resolve('') }));

    const scraper = new Site1Scraper();
    await expect(scraper.scrapeListingPage()).rejects.toThrow('HTTP 503');
  });
});
