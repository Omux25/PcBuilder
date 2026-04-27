/**
 * Site 2 Scraper — placeholder for the second Moroccan retailer.
 *
 * HOW TO ADAPT THIS TO A REAL SITE:
 * 1. Set SITE_NAME and RETAILER_ID to match the row in the `retailers` table.
 * 2. Inspect the retailer's product pages in your browser (F12 → Elements).
 * 3. Replace the TODO selectors below with the real CSS selectors you find.
 * 4. Update PRODUCT_URLS with the real component_id → URL mapping.
 * 5. Run the scraper manually to verify: bun scraper/scrapers/site2Scraper.ts
 *
 * Pattern: individual product pages — one URL per component.
 * This is common on sites that don't have a structured listing page.
 *
 * Requirements: 6.1, 6.2, 6.3
 */

import { BaseScraper, type ScrapedPrice } from './baseScraper.js';
import type { CheerioAPI } from 'cheerio';

// ── Configuration ─────────────────────────────────────────────────────────────

/** Must match the `name` column in the `retailers` table. */
const SITE_NAME = 'site2.ma';

/** Must match the `id` column in the `retailers` table. */
const RETAILER_ID = 2;

/**
 * Map of component_id → product page URL.
 * Add one entry per component you want to track on this site.
 *
 * Example:
 *   1 → 'https://site2.ma/produit/amd-ryzen-9-7950x'
 *   2 → 'https://site2.ma/produit/asus-rog-strix-b650'
 */
const PRODUCT_URLS: Record<number, string> = {
  // TODO: fill in real component_id → URL mappings
  // 1: 'https://site2.ma/produit/...',
  // 2: 'https://site2.ma/produit/...',
};

// ── Selectors ─────────────────────────────────────────────────────────────────
// Inspect the product page HTML and replace these with real CSS selectors.

/** Element that contains the price text (e.g. "2 499,00 MAD"). */
const SELECTOR_PRICE = '.price-box .price';              // TODO: replace

/** Element that indicates stock status. */
const SELECTOR_STOCK = '.availability';                  // TODO: replace

/** Text content of SELECTOR_STOCK when the product is in stock. */
const IN_STOCK_TEXT = 'Disponible';                      // TODO: replace

// ── Scraper class ─────────────────────────────────────────────────────────────

export class Site2Scraper extends BaseScraper {
  constructor() {
    super(SITE_NAME);
  }

  /**
   * Scrapes all configured product pages and returns combined price records.
   * Skips individual pages that fail — one broken URL doesn't abort the rest.
   */
  async scrapeAllProducts(): Promise<ScrapedPrice[]> {
    const results: ScrapedPrice[] = [];

    for (const [componentIdStr, url] of Object.entries(PRODUCT_URLS)) {
      const component_id = Number(componentIdStr);
      try {
        const prices = await this.scrape(url);
        // extractPrices() on a single-product page returns at most one record,
        // but we need to inject the component_id since the page doesn't have it.
        for (const p of prices) {
          results.push({ ...p, component_id });
        }
      } catch {
        // Individual page failures are logged by the scheduler — keep going
      }
    }

    return results;
  }

  protected extractPrices($: CheerioAPI): ScrapedPrice[] {
    // ── price ─────────────────────────────────────────────────────────────────
    const rawPrice = $(SELECTOR_PRICE).first().text().trim();
    const price = parseFloat(rawPrice.replace(/[^\d,]/g, '').replace(',', '.'));
    if (isNaN(price) || price <= 0) return [];

    // ── in_stock ──────────────────────────────────────────────────────────────
    const stockText = $(SELECTOR_STOCK).first().text().trim();
    const in_stock = stockText === IN_STOCK_TEXT;

    // ── product_url ───────────────────────────────────────────────────────────
    // For single-product pages, the canonical URL is the page itself.
    // The aggregator will use the URL passed to scrape() — we return a
    // placeholder here; the caller (scrapeAllProducts) has the real URL.
    const product_url = $('link[rel="canonical"]').attr('href') ?? '';

    // component_id is injected by scrapeAllProducts() — use 0 as placeholder
    return [{ component_id: 0, retailer_id: RETAILER_ID, price, in_stock, product_url }];
  }
}
