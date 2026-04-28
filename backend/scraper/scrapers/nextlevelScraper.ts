/**
 * NextLevel PC Scraper — scrapes PC component prices from nextlevelpc.ma
 *
 * Strategy (based on HTML inspection):
 * - JSON-LD ItemList provides product names and URLs (20 per page)
 * - span.price provides prices in order matching the JSON-LD list
 * - Stock status: "EN STOCK" text appears in the page for in-stock items
 *
 * Pagination: /categorie-produit/{category}/page/{n}
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
  /** Stores the max page number found during the last extractPrices call. */
  private lastTotalPages = 1;

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
    // Fetch page 1 — extractPrices will also detect total pages via pagination links
    this.lastTotalPages = 1;
    const page1Prices = await this.scrape(baseUrl).catch(() => [] as ScrapedPrice[]);

    if (page1Prices.length === 0) return [];

    const totalPages = this.lastTotalPages;
    if (totalPages <= 1) return page1Prices;

    // Fetch all remaining pages in parallel
    const pagePromises = Array.from({ length: totalPages - 1 }, (_, i) =>
      this.scrape(`${baseUrl}?page=${i + 2}`).catch(() => [] as ScrapedPrice[])
    );
    const pageResults = await Promise.all(pagePromises);

    return [...page1Prices, ...pageResults.flat()];
  }

  protected extractPrices($: CheerioAPI): ScrapedPrice[] {
    const prices: ScrapedPrice[] = [];

    // Detect total pages from pagination links — store for scrapeCategory to use
    const pageNums: number[] = [];
    $('a[href*="page="]').each((_i, el) => {
      const href = $(el).attr('href') ?? '';
      const m = href.match(/[?&]page=(\d+)/);
      if (m) pageNums.push(parseInt(m[1]));
    });
    if (pageNums.length > 0) {
      this.lastTotalPages = Math.max(...pageNums);
    }

    // Strategy: extract products from JSON-LD ItemList (names + URLs)
    // then pair with prices from span.price elements (same order)
    const jsonLdProducts: { name: string; url: string }[] = [];

    $('script[type="application/ld+json"]').each((_i, el) => {
      const content = $(el).html() ?? '';
      try {
        const data = JSON.parse(content);
        if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
          for (const item of data.itemListElement) {
            if (item.item?.['@type'] === 'Product') {
              jsonLdProducts.push({
                name: item.item.name ?? '',
                url: item.item.url ?? '',
              });
            }
          }
        }
      } catch { /* skip */ }
    });

    if (jsonLdProducts.length === 0) return [];

    // Extract prices in order — span.price appears multiple times per product
    // (the theme renders each product card multiple times for mobile/desktop)
    // We need unique prices in the same order as JSON-LD products
    const allPriceEls: string[] = [];
    $('span.price').each((_i, el) => {
      const text = $(el).text().trim();
      if (text.match(/\d[\s\d]*,\d{2}/)) {
        allPriceEls.push(text);
      }
    });

    // The theme renders each product 4 times — take every 4th price
    // (or deduplicate by taking unique consecutive values)
    const uniquePrices: string[] = [];
    for (let i = 0; i < allPriceEls.length; i++) {
      if (i === 0 || allPriceEls[i] !== allPriceEls[i - 1]) {
        uniquePrices.push(allPriceEls[i]);
      }
    }

    // Build per-product stock map from product cards.
    // Use the badge text (.badge-name-text) which reliably shows "EN STOCK" or "RUPTURE DE STOCK".
    // The .out-of-stock/.hide approach is unreliable — NextLevel sometimes keeps .hide even when out of stock.
    const stockByUrl = new Map<string, boolean>();
    $('article.product-miniature').each((_i, card) => {
      const url = $(card).find('a[itemprop="url"], a.product-thumbnail').first().attr('href') ?? '';
      if (!url) return;
      // Get the first badge text — "EN STOCK" = in stock, anything else (including "RUPTURE DE STOCK") = out
      const badgeText = $(card).find('.badge-name-text').first().text().trim().toUpperCase();
      const inStock = badgeText === 'EN STOCK';
      stockByUrl.set(url, inStock);
    });

    // For each JSON-LD product, pair with price and per-product stock status
    for (let i = 0; i < jsonLdProducts.length; i++) {
      const product = jsonLdProducts[i];
      if (!product.url || !product.name) continue;

      // Skip bundle/pack products (they contain "+")
      if (product.name.includes('+')) continue;

      const rawPrice = uniquePrices[i] ?? '';
      if (!rawPrice) continue;

      const price = parseFloat(
        rawPrice
          .replace(/\s/g, '')
          .replace(/[^\d,]/g, '')
          .replace(',', '.')
      );
      if (isNaN(price) || price <= 0) continue;

      // Per-product stock from card — fall back to true if card not found
      const in_stock = stockByUrl.get(product.url) ?? true;

      prices.push({
        component_id: 0,
        retailer_id: RETAILER_ID,
        price,
        in_stock,
        product_url: product.url,
        product_name: product.name,
      });
    }

    return prices;
  }
}
