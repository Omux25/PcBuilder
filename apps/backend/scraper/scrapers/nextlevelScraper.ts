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

import { BaseScraper, type ScrapedPrice, getRetryDelay } from './baseScraper.js';
import type { CheerioAPI } from 'cheerio';

const SITE_NAME = 'nextlevelpc.ma';

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
  private _retailerId: number = 0;

  constructor() {
    super(SITE_NAME);
  }

  async scrapeAllCategories(retailer_id: number): Promise<ScrapedPrice[]> {
    this._retailerId = retailer_id;

    // Scrape categories sequentially to avoid triggering rate limiting (503s).
    // Parallel scraping hammers the server and gets blocked on later pages.
    const allPrices: ScrapedPrice[] = [];
    for (const url of CATEGORY_URLS) {
      try {
        const prices = await this.scrapeCategory(url, retailer_id);
        allPrices.push(...prices);
      } catch (err) {
        console.error(`[${SITE_NAME}] Category failed: ${err}`);
      }
      // Balanced pause between categories - 500ms to avoid 503 errors
      const categoryDelay = getRetryDelay(500);
      if (categoryDelay > 0) await new Promise(resolve => setTimeout(resolve, categoryDelay));
    }
    return allPrices;
  }

  private async scrapeCategory(baseUrl: string, retailer_id: number): Promise<ScrapedPrice[]> {
    const allPrices: ScrapedPrice[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
      try {
        const $ = await this.fetchAndParse(url);
        const pagePrices = this.extractPrices($);
        if (pagePrices.length === 0) break;

        allPrices.push(...pagePrices);

        if (page === 1) {
          totalPages = this.parseTotalPages($);
        }

        page++;

        // Balanced delay between pages - 200ms to avoid 503 errors
        if (page <= totalPages) {
          const pageDelay = getRetryDelay(200);
          if (pageDelay > 0) await new Promise(resolve => setTimeout(resolve, pageDelay));
        }
      } catch (err) {
        console.error(`[${SITE_NAME}] Failed to fetch page ${page} of ${baseUrl}: ${err}`);
        break;
      }
    } while (page <= totalPages);

    return allPrices;
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

      // Product description — extract spec features from the hidden specs block
      // (.product-features li contains lines like "Quantité mémoire : 8GB GDDR6")
      // Used as fallback for variant extraction when VRAM isn't in the product name.
      const featureLines = $(card).find('.product-features li')
        .map((_j, li) => $(li).text().trim())
        .get()
        .filter(Boolean);
      const product_description = featureLines.length > 0 ? featureLines.join(' | ') : undefined;

      // Extract product image URL from the thumbnail
      // Upgrade NextLevel image size: home_default (250px) → large_default (800px)
      const rawImageUrl = $(card).find('img[itemprop="image"], img.product-thumbnail, .product-thumbnail img')
        .first()
        .attr('src') || undefined;
      const image_url = rawImageUrl
        ? rawImageUrl.replace(/-home_default\//, '-large_default/')
        : undefined;

      prices.push({
        retailer_id: this._retailerId,
        price,
        in_stock,
        product_url: url,
        product_name: name,
        product_description,
        image_url,
      });
    });

    return prices;
  }
}
