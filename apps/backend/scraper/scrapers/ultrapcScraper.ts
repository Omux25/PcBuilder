/**
 * UltraPC Scraper — scrapes PC component prices from ultrapc.ma
 *
 * ultrapc.ma is a PrestaShop store.
 *
 * Strategy: fetch full HTML (no X-Requested-With header) and parse product
 * cards directly with cheerio. This gives us name, URL, price, image, AND
 * stock status in a single request per page — no secondary AJAX calls needed.
 *
 * Card structure (verified 2026-05-08):
 *   <article class="product-miniature">
 *     <a class="product-thumbnail" href="...url...">
 *     <h3 class="product-title"><a>Name</a></h3>
 *     <span class="price">1 349,00 MAD</span>
 *     <span class="product-availability">Produit en stock</span>  ← in stock
 *     <img ... src="...image...">
 *   </article>
 *
 * OOS products: no availability span, or text is "Rupture de stock".
 *
 * Pagination: ?page=N, total pages from pagination links or JSON blob.
 *
 * Requirements: 6.1, 6.2, 6.3
 */

import { BaseScraper, type ScrapedPrice, getRetryDelay } from './baseScraper.js';
import type { CheerioAPI } from 'cheerio';

const SITE_NAME = 'ultrapc.ma';

const CATEGORY_URLS: string[] = [
  'https://www.ultrapc.ma/21-processeurs',
  // HEDT CPU sub-categories not listed on the main CPU page
  'https://www.ultrapc.ma/173-socket-amd-tr4',
  'https://www.ultrapc.ma/255-socket-swrx8',
  'https://www.ultrapc.ma/120-socket-2066',
  'https://www.ultrapc.ma/28-cartes-meres',
  'https://www.ultrapc.ma/39-cartes-graphiques',
  'https://www.ultrapc.ma/35-memoire-vive-pc',
  'https://www.ultrapc.ma/139-disques-ssd',
  'https://www.ultrapc.ma/138-disques-durs-internes',
  'https://www.ultrapc.ma/43-alimentations-pc',
  'https://www.ultrapc.ma/48-boitier-pc',
  'https://www.ultrapc.ma/44-refroidissement',
];

// ── Dependency injection (kept for test compatibility) ────────────────────────

import { setFetch, resetFetchAndLoad } from './baseScraper.js';
export { setFetch as setUltraPcFetch, resetFetchAndLoad as resetUltraPcFetch };

export class UltraPcScraper extends BaseScraper {
  private _retailerId: number = 0;

  constructor() {
    super(SITE_NAME);
  }

  async scrapeAllCategories(retailer_id: number): Promise<ScrapedPrice[]> {
    this._retailerId = retailer_id;

    // Parallel — UltraPC handles concurrent requests fine
    const results = await Promise.allSettled(
      CATEGORY_URLS.map((url) => this.scrapeCategory(url, retailer_id))
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

        // Fix retailer_id (BaseScraper.extractPrices doesn't know it)
        for (const p of pagePrices) p.retailer_id = retailer_id;
        allPrices.push(...pagePrices);

        if (page === 1) {
          totalPages = this.parseTotalPages($);
        }

        page++;
        if (page <= totalPages) {
          const delay = getRetryDelay(150);
          if (delay > 0) await new Promise(r => setTimeout(r, delay));
        }
      } catch (err) {
        console.error(`[${SITE_NAME}] Failed page ${page} of ${baseUrl}: ${err}`);
        break;
      }
    } while (page <= totalPages && page <= 15);

    return allPrices;
  }

  private parseTotalPages($: CheerioAPI): number {
    // Try pagination links first
    const pageNums: number[] = [];
    $('a[href*="page="], .pagination a').each((_i, el) => {
      const href = $(el).attr('href') ?? '';
      const m = href.match(/[?&]page=(\d+)/);
      if (m) pageNums.push(parseInt(m[1]));
      // Also check link text for page numbers
      const text = $(el).text().trim();
      if (/^\d+$/.test(text)) pageNums.push(parseInt(text));
    });
    if (pageNums.length > 0) return Math.max(...pageNums);

    // Fallback: extract from embedded JSON pagination blob
    // PrestaShop embeds {"pagination":{"pages_count":N}} in a script tag
    const html = $.html();
    const m = html.match(/"pages_count"\s*:\s*(\d+)/);
    if (m) return parseInt(m[1]);

    return 1;
  }

  protected extractPrices($: CheerioAPI): ScrapedPrice[] {
    const prices: ScrapedPrice[] = [];

    $('article.product-miniature, .js-product-miniature').each((_i, card) => {
      // URL
      const url = $(card).find('a.product-thumbnail, a[itemprop="url"]').first().attr('href')
        ?? $(card).find('h3 a, .product-title a').first().attr('href');
      if (!url) return;

      // Skip bundles (contain "+")
      const name = $(card).find('.product-title a, h3 a, h2 a').first().text().trim();
      if (!name || name.includes('+')) return;

      // Price — first span.price in this card
      const rawPrice = $(card).find('span.price').first().text().trim();
      if (!rawPrice) return;
      const price = parseFloat(
        rawPrice.replace(/\s/g, '').replace(/[^\d,]/g, '').replace(',', '.')
      );
      if (isNaN(price) || price <= 0) return;

      // Stock — "Produit en stock" text in availability span or card HTML
      const availText = $(card).find('.product-availability, .availability').first().text().trim();
      const cardHtml = $(card).html() ?? '';
      const in_stock =
        availText.toLowerCase().includes('en stock') ||
        cardHtml.includes('Produit en stock') ||
        cardHtml.includes('product-available');

      // Image — prefer large_default (800×800 square product shot).
      // UltraPC serves large_banner (banner crop) by default — swap to large_default.
      const rawImageUrl =
        $(card).find('img[data-full-size-image-url]').attr('data-full-size-image-url') ??
        $(card).find('img.js-lazy-image').attr('data-src') ??
        $(card).find('img').first().attr('src') ??
        undefined;
      const image_url = rawImageUrl
        ? rawImageUrl.replace(/-large_banner\//, '-large_default/')
          .replace(/-home_default\//, '-large_default/')
        : undefined;

      // Description from short desc if present
      const product_description = $(card).find('.product-description, .short-desc').first().text().trim() || undefined;

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
