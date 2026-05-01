/**
 * NextLevel PC Scraper — scrapes PC component prices from nextlevelpc.ma
 *
 * Strategy (based on HTML inspection):
 * - JSON-LD ItemList provides product names and URLs (20 per page)
 * - span.price provides prices in order matching the JSON-LD list
 * - Stock status: badge text ".badge-name-text" — "EN STOCK" = in stock
 *
 * Pagination: ?page=N (confirmed working, /page/N returns 404)
 *
 * Race condition fix: the old code stored total pages in an instance variable
 * (lastTotalPages) which was overwritten by parallel category scrapes.
 * Now scrapeCategory() calls fetchAndParse() once for page 1, extracts both
 * products AND total pages from the same Cheerio object — no shared state.
 *
 * Requirements: 6.1, 6.2, 6.3
 */

import { BaseScraper, type ScrapedPrice } from './baseScraper.js';
import type { CheerioAPI } from 'cheerio';

const SITE_NAME   = 'nextlevelpc.ma';
const RETAILER_ID = 11;

const CATEGORY_URLS: string[] = [
  'https://nextlevelpc.ma/165-processeur',
  'https://nextlevelpc.ma/144-carte-graphique-video-gpu',
  'https://nextlevelpc.ma/169-carte-mere',
  'https://nextlevelpc.ma/181-memoire-ram',
  'https://nextlevelpc.ma/250-disques-durs',
  'https://nextlevelpc.ma/179-alimentation-pc-psu',
  'https://nextlevelpc.ma/253-boitier-gamer',
  'https://nextlevelpc.ma/269-cpu-cooler',
];

export class NextLevelScraper extends BaseScraper {
  constructor() {
    super(SITE_NAME);
  }

  async scrapeAllCategories(): Promise<ScrapedPrice[]> {
    const results = await Promise.allSettled(
      CATEGORY_URLS.map((url) => this.scrapeCategory(url))
    );

    const allPrices: ScrapedPrice[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allPrices.push(...result.value);
      } else {
        console.error(`[${SITE_NAME}] Category failed: ${result.reason}`);
      }
    }
    return allPrices;
  }

  private async scrapeCategory(baseUrl: string): Promise<ScrapedPrice[]> {
    // Fetch page 1 once — parse both products AND total pages from the same HTML.
    // This avoids any shared instance state between parallel category calls.
    let $page1: CheerioAPI;
    try {
      $page1 = await this.fetchAndParse(baseUrl);
    } catch {
      return [];
    }

    const page1Prices = this.extractPrices($page1);
    if (page1Prices.length === 0) return [];

    // Extract total pages from the same Cheerio object — no race condition possible
    const totalPages = this.parseTotalPages($page1);
    if (totalPages <= 1) return page1Prices;

    // Fetch all remaining pages in parallel
    const pagePromises = Array.from({ length: totalPages - 1 }, (_, i) =>
      this.scrape(`${baseUrl}?page=${i + 2}`).catch(() => [] as ScrapedPrice[])
    );
    const pageResults = await Promise.all(pagePromises);

    return [...page1Prices, ...pageResults.flat()];
  }

  /**
   * Extracts the total number of pages from pagination links.
   * Returns 1 if no pagination is found (single-page category).
   */
  private parseTotalPages($: CheerioAPI): number {
    const pageNums: number[] = [];
    $('a[href*="page="]').each((_i, el) => {
      const href = $(el).attr('href') ?? '';
      const m = href.match(/[?&]page=(\d+)/);
      if (m) pageNums.push(parseInt(m[1]));
    });
    return pageNums.length > 0 ? Math.max(...pageNums) : 1;
  }

  protected extractPrices($: CheerioAPI): ScrapedPrice[] {
    const prices: ScrapedPrice[] = [];

    // Strategy: extract price, URL, name, and stock directly from each product card.
    // This is more reliable than pairing JSON-LD products with span.price by index,
    // because bundle products (containing "+") appear in the card list but are skipped
    // in JSON-LD, causing index drift and wrong price assignments.
    $('article.product-miniature').each((_i, card) => {
      const url = $(card).find('a[itemprop="url"], a.product-thumbnail').first().attr('href') ?? '';
      if (!url) return;

      // Product name — from itemprop or title element
      const name = $(card).find('[itemprop="name"]').first().text().trim() ||
                   $(card).find('.product-title a').first().text().trim() ||
                   $(card).find('h2 a, h3 a').first().text().trim();

      // Skip bundle products (contain "+")
      if (name.includes('+')) return;

      // Price — first span.price inside this card
      const rawPrice = $(card).find('span.price').first().text().trim();
      if (!rawPrice) return;

      const price = parseFloat(
        rawPrice
          .replace(/\s/g, '')
          .replace(/[^\d,]/g, '')
          .replace(',', '.')
      );
      if (isNaN(price) || price <= 0) return;

      // Stock status from badge
      const badgeText = $(card).find('.badge-name-text').first().text().trim().toUpperCase();
      const in_stock = badgeText === 'EN STOCK';

      prices.push({
        component_id: 0,
        retailer_id: RETAILER_ID,
        price,
        in_stock,
        product_url: url,
        product_name: name,
      });
    });

    return prices;
  }
}
