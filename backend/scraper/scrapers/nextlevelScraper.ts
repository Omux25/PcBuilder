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
  constructor() {
    super(SITE_NAME);
  }

  async scrapeAllCategories(): Promise<ScrapedPrice[]> {
    const allPrices: ScrapedPrice[] = [];

    for (const baseUrl of CATEGORY_URLS) {
      try {
        const prices = await this.scrapeCategory(baseUrl);
        allPrices.push(...prices);
      } catch (err) {
        console.error(`[${SITE_NAME}] Failed to scrape ${baseUrl}: ${(err as Error).message}`);
      }
    }

    return allPrices;
  }

  private async scrapeCategory(baseUrl: string): Promise<ScrapedPrice[]> {
    const prices: ScrapedPrice[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 20) {
      // Use ?page=N for numeric ID URLs, /page/N for slug URLs
      const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
      try {
        const pagePrices = await this.scrape(url);
        prices.push(...pagePrices);
        hasMore = pagePrices.length >= 12;
      } catch {
        hasMore = false;
      }
      page++;

      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return prices;
  }

  protected extractPrices($: CheerioAPI): ScrapedPrice[] {
    const prices: ScrapedPrice[] = [];

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

    // Extract stock status — "EN STOCK" text in the page
    // Count EN STOCK occurrences to determine which products are in stock
    const pageText = $.root().text();
    const enStockCount = (pageText.match(/EN STOCK/g) ?? []).length;

    // For each JSON-LD product, pair with price
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

      // Assume in stock if EN STOCK appears enough times
      // (rough heuristic — most products on the page are in stock)
      const in_stock = enStockCount > 0;

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
