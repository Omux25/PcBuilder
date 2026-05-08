/**
 * UltraPC Scraper — scrapes PC component prices from ultrapc.ma
 *
 * ultrapc.ma is a PrestaShop store. The category page (with X-Requested-With
 * header) returns HTML that embeds both:
 *   1. A JSON blob in a <script> tag — product name, URL, price, image
 *   2. Rendered product cards in HTML — "Produit en stock" text per card
 *
 * We extract name/price/url/image from JSON (fast, structured) and
 * in_stock from the HTML card (no extra HTTP calls needed).
 *
 * Stock detection: card contains "Produit en stock" → in stock.
 * No text / "Rupture de stock" → out of stock.
 *
 * Pagination: ?page=N, extracted from JSON pagination object.
 *
 * Requirements: 6.1, 6.2, 6.3
 */

import { fetch } from 'undici';
import * as cheerio from 'cheerio';
import type { ScrapedPrice } from './baseScraper.js';

const SITE_NAME = 'ultrapc.ma';

const HEADERS = {
  'User-Agent': 'PCBuilderMaroc-Bot/1.0 (price comparator; +https://pcbuilder.ma)',
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'text/html,application/xhtml+xml,*/*',
};

// ── Dependency injection ──────────────────────────────────────────────────────

type FetchFn = (url: string, init?: Record<string, unknown>) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

let _fetch: FetchFn = fetch as unknown as FetchFn;

export function setUltraPcFetch(mockFetch: FetchFn): void {
  _fetch = mockFetch;
}

export function resetUltraPcFetch(): void {
  _fetch = fetch as unknown as FetchFn;
}

const CATEGORY_URLS: string[] = [
  'https://www.ultrapc.ma/21-processeurs',
  'https://www.ultrapc.ma/28-cartes-meres',
  'https://www.ultrapc.ma/39-cartes-graphiques',
  'https://www.ultrapc.ma/35-memoire-vive-pc',
  'https://www.ultrapc.ma/139-disques-ssd',
  'https://www.ultrapc.ma/138-disques-durs-internes',
  'https://www.ultrapc.ma/43-alimentations-pc',
  'https://www.ultrapc.ma/48-boitier-pc',
  'https://www.ultrapc.ma/44-refroidissement',
];

interface UltraPcProduct {
  name: string;
  url: string;
  canonical_url: string;
  price_amount: number;
  active: string;
  id_product?: number;
  description_short?: string;
  cover?: {
    bySize?: Record<string, { url: string; width: number; height: number }>;
    medium?: { url: string };
    small?: { url: string };
  };
}

interface UltraPcResponse {
  products?: UltraPcProduct[];
  pagination?: {
    total_items: number;
    pages_count: number;
    current_page: number;
  };
}

export class UltraPcScraper {
  readonly siteName = SITE_NAME;

  async scrapeAllCategories(retailer_id: number): Promise<ScrapedPrice[]> {
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
    const prices: ScrapedPrice[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const url = page === 1 ? `${baseUrl}?page=1` : `${baseUrl}?page=${page}`;

      const response = await _fetch(url, { headers: HEADERS as Record<string, unknown> });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${url}`);
      }

      const html = await response.text();

      // Extract structured product data from embedded JSON
      const data = this.extractProductData(html);

      // Build URL → in_stock map from HTML card parsing.
      // Each card has a canonical URL and optionally "Produit en stock" text.
      // This is O(1) per product — no extra HTTP calls.
      const stockByUrl = this.extractStockFromHtml(html);

      if (data.products) {
        for (const product of data.products) {
          const price = this.parsePrice(product.price_amount);
          if (!price || price <= 0) continue;

          const product_url = product.canonical_url || product.url;
          if (!product_url) continue;

          // Prefer HTML-parsed stock (accurate). Fall back to false if URL not found
          // in the stock map — safer than assuming in_stock=true.
          const in_stock = stockByUrl.get(product_url) ?? stockByUrl.get(product.url) ?? false;

          const image_url =
            product.cover?.bySize?.home_default?.url ??
            product.cover?.medium?.url ??
            product.cover?.small?.url ??
            undefined;

          prices.push({
            retailer_id,
            price,
            in_stock,
            product_url,
            product_name: product.name,
            product_description: product.description_short || undefined,
            image_url,
          });
        }
      }

      if (data.pagination) {
        totalPages = data.pagination.pages_count;
      }

      page++;

      if (page <= totalPages) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } while (page <= totalPages && page <= 10);

    return prices;
  }

  /**
   * Parse stock status from HTML product cards.
   * Returns Map<product_url, in_stock>.
   *
   * UltraPC card structure (simplified):
   *   <article class="product-miniature" ...>
   *     <a class="product-thumbnail" href="https://www.ultrapc.ma/...">
   *     ...
   *     <span class="product-availability">Produit en stock</span>  ← in stock
   *     OR nothing / "Rupture de stock"                              ← OOS
   *   </article>
   *
   * Also handles the plain-text "Produit en stock" that appears after the
   * price in the rendered HTML (seen in fetched content above).
   */
  private extractStockFromHtml(html: string): Map<string, boolean> {
    const stockMap = new Map<string, boolean>();
    const $ = cheerio.load(html);

    // Method 1: article.product-miniature cards (standard PrestaShop structure)
    $('article.product-miniature, .js-product-miniature').each((_i, card) => {
      const url = $(card).find('a.product-thumbnail, a[itemprop="url"]').first().attr('href');
      if (!url) return;

      const availText = $(card).find('.product-availability, .availability').first().text().trim();
      const cardHtml = $(card).html() ?? '';

      const inStock =
        availText.toLowerCase().includes('en stock') ||
        availText.toLowerCase().includes('produit en stock') ||
        cardHtml.includes('Produit en stock') ||
        cardHtml.includes('product-available');

      stockMap.set(url, inStock);
    });

    // Method 2: fallback — scan all product links and check nearby text
    // Handles cases where PrestaShop renders cards differently
    if (stockMap.size === 0) {
      $('a[href*="ultrapc.ma"]').each((_i, el) => {
        const url = $(el).attr('href');
        if (!url || !url.includes('.html')) return;
        // Check parent container for stock text
        const parent = $(el).closest('div, article, li');
        const text = parent.text();
        const inStock = text.includes('Produit en stock') && !text.includes('Rupture de stock');
        if (!stockMap.has(url)) stockMap.set(url, inStock);
      });
    }

    return stockMap;
  }

  private extractProductData(text: string): UltraPcResponse {
    // Try raw JSON first
    try {
      const data = JSON.parse(text) as UltraPcResponse;
      if (data.products) return data;
    } catch { /* not raw JSON */ }

    // Extract from embedded script JSON
    const productsMatch = text.match(/"products"\s*:\s*(\[[\s\S]*?\])\s*,\s*"sort_orders"/);
    if (productsMatch) {
      try {
        const products = JSON.parse(productsMatch[1]) as UltraPcProduct[];
        const paginationMatch = text.match(/"pagination"\s*:\s*(\{[^}]+\})/);
        let pagination;
        if (paginationMatch) {
          try { pagination = JSON.parse(paginationMatch[1]); } catch { /* ignore */ }
        }
        return { products, pagination };
      } catch { /* parsing failed */ }
    }

    return {};
  }

  private parsePrice(priceAmount: number | string | undefined): number {
    if (typeof priceAmount === 'number') return priceAmount;
    if (typeof priceAmount === 'string') {
      const cleaned = priceAmount.replace(/[^\d.]/g, '');
      return parseFloat(cleaned);
    }
    return NaN;
  }
}
