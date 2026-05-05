/**
 * SetupGame Scraper — scrapes PC component prices from setupgame.ma
 *
 * setupgame.ma is a WooCommerce store. The public WooCommerce Store API
 * (/wp-json/wc/store/v1/products) returns full product data including
 * prices, stock status, and URLs without authentication.
 *
 * Price format: stored in cents (e.g. 219900 = 2199.00 MAD)
 * Pagination: uses ?page=N&per_page=100
 *
 * Category IDs (verified from /wp-json/wc/store/v1/products/categories):
 *   86  = Processeurs
 *   219 = Carte Graphique
 *   130 = Carte Mère
 *   246 = Mémoire vive PC (RAM)
 *   270 = Stockage
 *   318 = Blocs d'Alimentation (PSU)
 *   347 = Boitier Gamer
 *   295 = Aircooler
 *   305 = Watercooler
 *
 * Requirements: 6.1, 6.2, 6.3
 */

import { fetch } from 'undici';
import type { ScrapedPrice } from './baseScraper.js';

const SITE_NAME = 'setupgame.ma';

const BASE_URL = 'https://setupgame.ma/wp-json/wc/store/v1/products';
const PER_PAGE = 100;

const CATEGORY_IDS = [86, 219, 130, 246, 270, 318, 347, 295, 305];

interface StoreProduct {
  id: number;
  name: string;
  permalink: string;
  short_description?: string;
  prices: {
    price: string;
    currency_minor_unit: number;
  };
  is_in_stock: boolean;
  categories: { id: number; name: string }[];
}

// ── Dependency injection for tests ───────────────────────────────────────────

type FetchFn = (url: string, init?: Record<string, unknown>) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

let _fetch: FetchFn = fetch as unknown as FetchFn;

export function setSetupGameFetch(mockFetch: FetchFn): void {
  _fetch = mockFetch;
}

export function resetSetupGameFetch(): void {
  _fetch = fetch as unknown as FetchFn;
}

// ── Scraper ───────────────────────────────────────────────────────────────────

export class SetupGameScraper {
  readonly siteName = SITE_NAME;

  async scrapeAllCategories(retailer_id: number): Promise<ScrapedPrice[]> {
    const results = await Promise.allSettled(
      CATEGORY_IDS.map((id) => this.scrapeCategory(id, retailer_id))
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

  private async scrapeCategory(categoryId: number, retailer_id: number): Promise<ScrapedPrice[]> {
    const prices: ScrapedPrice[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 20) {
      const url = `${BASE_URL}?category=${categoryId}&per_page=${PER_PAGE}&page=${page}`;

      const response = await _fetch(url, {
        headers: {
          'User-Agent': 'PCBuilderMaroc-Bot/1.0 (price comparator; +https://pcbuilder.ma)',
          'Accept': 'application/json',
          'Origin': 'https://setupgame.ma',
          'Referer': 'https://setupgame.ma/',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching category ${categoryId} page ${page}`);
      }

      const products = await response.json() as StoreProduct[];

      if (!Array.isArray(products) || products.length === 0) {
        hasMore = false;
        break;
      }

      for (const product of products) {
        // Skip bundle/PC Gamer products — we only want individual components
        // Individual components are in the component categories, not PC Gamer categories
        const isInComponentCategory = product.categories.some((c) =>
          CATEGORY_IDS.includes(c.id)
        );
        if (!isInComponentCategory) continue;

        const product_url = product.permalink;
        const product_name = product.name;
        if (!product_url || !product_name) continue;

        // Price is in cents — divide by 10^currency_minor_unit
        const minorUnit = product.prices.currency_minor_unit ?? 2;
        const price = parseInt(product.prices.price, 10) / Math.pow(10, minorUnit);
        if (isNaN(price) || price <= 0) continue;

        const in_stock = product.is_in_stock;

        // Strip HTML tags from short_description for use as variant fallback
        const rawDesc = product.short_description ?? '';
        const product_description = rawDesc
          ? rawDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || undefined
          : undefined;

        prices.push({
          retailer_id,
          price,
          in_stock,
          product_url,
          product_name,
          product_description,
        });
      }

      hasMore = products.length === PER_PAGE;
      page++;

      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    return prices;
  }
}
