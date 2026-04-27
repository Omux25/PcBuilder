/**
 * Site 1 Scraper — placeholder for the first Moroccan retailer.
 *
 * HOW TO ADAPT THIS TO A REAL SITE:
 * 1. Set SITE_NAME and RETAILER_ID to match the row in the `retailers` table.
 * 2. Inspect the retailer's product listing page in your browser (F12 → Elements).
 * 3. Replace the TODO selectors below with the real CSS selectors you find.
 * 4. Run the scraper manually to verify: bun scraper/scrapers/site1Scraper.ts
 *
 * Pattern: product listing page — one URL contains multiple products.
 * Each product card has a component_id encoded in a data attribute or URL slug.
 *
 * Requirements: 6.1, 6.2, 6.3
 */

import { BaseScraper, type ScrapedPrice } from './baseScraper.js';
import type { CheerioAPI } from 'cheerio';

// ── Configuration ─────────────────────────────────────────────────────────────

/** Must match the `name` column in the `retailers` table. */
const SITE_NAME = 'site1.ma';

/** Must match the `id` column in the `retailers` table. */
const RETAILER_ID = 1;

/**
 * URL of the product listing page to scrape.
 * Replace with the real URL once you know which page to target.
 */
const LISTING_URL = 'https://site1.ma/informatique/composants';

// ── Selectors ─────────────────────────────────────────────────────────────────
// Inspect the page HTML and replace these with real CSS selectors.

/** Container element for each product card on the listing page. */
const SELECTOR_PRODUCT_CARD = '.product-card';           // TODO: replace

/** Element inside the card that contains the price text (e.g. "1 299,00 MAD"). */
const SELECTOR_PRICE = '.product-price';                 // TODO: replace

/** Element or attribute that indicates stock status. */
const SELECTOR_STOCK = '.stock-status';                  // TODO: replace

/** Text content of SELECTOR_STOCK when the product is in stock. */
const IN_STOCK_TEXT = 'En stock';                        // TODO: replace

/** Attribute on the card (or a child element) that holds the product URL. */
const SELECTOR_PRODUCT_LINK = 'a.product-link';         // TODO: replace

/**
 * Data attribute on the card that maps to a component_id in our database.
 * If the site doesn't have this, you'll need a slug→id lookup table instead.
 */
const ATTR_COMPONENT_ID = 'data-component-id';          // TODO: replace

// ── Scraper class ─────────────────────────────────────────────────────────────

export class Site1Scraper extends BaseScraper {
  constructor() {
    super(SITE_NAME);
  }

  /**
   * Scrapes the product listing page and returns all found price records.
   * Call `scraper.scrape(LISTING_URL)` from the aggregator.
   */
  scrapeListingPage(): Promise<ScrapedPrice[]> {
    return this.scrape(LISTING_URL);
  }

  protected extractPrices($: CheerioAPI): ScrapedPrice[] {
    const prices: ScrapedPrice[] = [];

    $(SELECTOR_PRODUCT_CARD).each((_i, el) => {
      try {
        // ── component_id ──────────────────────────────────────────────────────
        const rawId = $(el).attr(ATTR_COMPONENT_ID);
        const component_id = rawId ? parseInt(rawId, 10) : NaN;
        if (isNaN(component_id)) return; // skip cards without a known component

        // ── price ─────────────────────────────────────────────────────────────
        // Prices on Moroccan sites often look like "1 299,00 MAD" or "1299.00 DH"
        // Strip non-numeric characters except the decimal separator.
        const rawPrice = $(el).find(SELECTOR_PRICE).text().trim();
        const price = parseFloat(rawPrice.replace(/[^\d,]/g, '').replace(',', '.'));
        if (isNaN(price) || price <= 0) return; // skip invalid prices

        // ── in_stock ──────────────────────────────────────────────────────────
        const stockText = $(el).find(SELECTOR_STOCK).text().trim();
        const in_stock = stockText === IN_STOCK_TEXT;

        // ── product_url ───────────────────────────────────────────────────────
        const href = $(el).find(SELECTOR_PRODUCT_LINK).attr('href') ?? '';
        const product_url = href.startsWith('http') ? href : `https://site1.ma${href}`;

        prices.push({ component_id, retailer_id: RETAILER_ID, price, in_stock, product_url });
      } catch {
        // Skip malformed cards — don't let one bad card abort the whole page
      }
    });

    return prices;
  }
}
