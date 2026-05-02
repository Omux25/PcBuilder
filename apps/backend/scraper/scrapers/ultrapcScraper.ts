/**
 * UltraPC Scraper — scrapes PC component prices from ultrapc.ma
 *
 * ultrapc.ma is a PrestaShop store. When a category page is requested with
 * the X-Requested-With: XMLHttpRequest header, it returns a JSON response
 * containing all product data (name, URL, price, stock status).
 *
 * Stock status: the listing API does NOT expose stock. We use the PrestaShop
 * product AJAX endpoint (?controller=product&id_product=X&ajax=1&action=refresh)
 * which returns HTML containing either "product-unavailable" or "product-available".
 * We only check stock for products that have a scraper_mapping (i.e. products we
 * actually display to users), not all 2164 products.
 *
 * JSON response structure (verified 2026-04-27):
 *   {
 *     products: [
 *       {
 *         name: "AMD Ryzen 5 7600X (4.7 GHz / 5.3 GHz)",
 *         url: "https://www.ultrapc.ma/socket-am5/4996-amd-ryzen-5-7600x.html",
 *         price_amount: 2390,
 *         active: "1",
 *         id_product: 4996,
 *         ...
 *       }
 *     ],
 *     pagination: {
 *       total_items: 157,
 *       pages_count: 5,
 *       current_page: 1
 *     }
 *   }
 *
 * Requirements: 6.1, 6.2, 6.3
 */

import { fetch } from 'undici';
import type { ScrapedPrice } from './baseScraper.js';

const SITE_NAME = 'ultrapc.ma';
const RETAILER_ID = 10; // ID in the retailers table

const HEADERS = {
  'User-Agent': 'PCBuilderMaroc-Bot/1.0 (price comparator; +https://pcbuilder.ma)',
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*',
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

/**
 * Category pages to scrape.
 * The JSON API returns 32 products per page by default.
 *
 * Note: category 35 (memoire-vive-pc) is the parent RAM category covering both
 * DDR4 and DDR5. Category 37 (memoire-vive-ddr4) is a subcategory — scraping
 * both would cause DDR4 products to be fetched twice. We use only the parent.
 */
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

  /**
   * Scrapes all component category pages and returns all found price records.
   * Categories are fetched in parallel to reduce total time.
   * Note: in_stock defaults to true — the aggregator checks actual stock
   * only for mapped products via the PrestaShop product API.
   */
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

  /**
   * Checks stock status for a subset of products using the PrestaShop AJAX endpoint.
   * Called by the aggregator only for mapped products (not all 2164 scraped products).
   * Mutates in_stock in place. Runs in parallel batches of 20.
   */
  async checkStock(prices: ScrapedPrice[]): Promise<void> {
    const BATCH_SIZE = 20;
    for (let i = 0; i < prices.length; i += BATCH_SIZE) {
      const batch = prices.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (price) => {
        const idMatch = price.product_url.match(/\/(\d+)-[^/]+\.html$/);
        if (!idMatch) return;
        try {
          const res = await _fetch(
            `https://www.ultrapc.ma/index.php?controller=product&id_product=${idMatch[1]}&ajax=1&action=refresh`,
            { headers: HEADERS as Record<string, unknown> }
          );
          if (!res.ok) return;
          const html = await res.text();
          price.in_stock = !html.includes('product-unavailable') && !html.includes('Rupture de stock');
        } catch { /* leave as true on failure */ }
      }));
    }
  }

  /**
   * Scrapes all pages of a category and returns price records.
   */
  private async scrapeCategory(baseUrl: string): Promise<ScrapedPrice[]> {
    const prices: ScrapedPrice[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const url = page === 1 ? `${baseUrl}?page=1` : `${baseUrl}?page=${page}`;

      const response = await _fetch(url, { headers: HEADERS as Record<string, unknown> });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${url}`);
      }

      const text = await response.text();

      // The response is a mix of HTML and embedded JSON.
      // Extract the JSON from the prestashop variable or parse the product data.
      const data = this.extractProductData(text);

      if (data.products) {
        for (const product of data.products) {
          const price = this.parsePrice(product.price_amount);
          if (!price || price <= 0) continue;

          const product_url = product.canonical_url || product.url;
          if (!product_url) continue;

          prices.push({
            retailer_id: RETAILER_ID,
            price,
            in_stock: true, // will be corrected by checkStockBatch after all pages are scraped
            product_url,
            product_name: product.name,
            product_description: product.description_short || undefined,
          });
        }
      }

      if (data.pagination) {
        totalPages = data.pagination.pages_count;
      }

      page++;

      // Small delay between pages to be respectful (100ms is enough for a JSON API)
      if (page <= totalPages) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } while (page <= totalPages && page <= 10); // cap at 10 pages per category

    return prices;
  }

  /**
   * Extracts product data from the response.
   * The AJAX response embeds JSON in a JavaScript variable or returns raw JSON.
   */
  private extractProductData(text: string): UltraPcResponse {
    // Try parsing as raw JSON first
    try {
      const data = JSON.parse(text) as UltraPcResponse;
      if (data.products) return data;
    } catch {
      // Not raw JSON — try extracting from embedded script
    }

    // Extract from the rendered_products JSON embedded in the page
    // Pattern: "products":[{...}]
    const productsMatch = text.match(/"products"\s*:\s*(\[[\s\S]*?\])\s*,\s*"sort_orders"/);
    if (productsMatch) {
      try {
        const products = JSON.parse(productsMatch[1]) as UltraPcProduct[];
        // Also extract pagination
        const paginationMatch = text.match(/"pagination"\s*:\s*(\{[^}]+\})/);
        let pagination;
        if (paginationMatch) {
          try { pagination = JSON.parse(paginationMatch[1]); } catch { /* ignore */ }
        }
        return { products, pagination };
      } catch {
        // Parsing failed
      }
    }

    return {};
  }

  /**
   * Parses a price value. The API returns price_amount as a number (e.g. 2390).
   */
  private parsePrice(priceAmount: number | string | undefined): number {
    if (typeof priceAmount === 'number') return priceAmount;
    if (typeof priceAmount === 'string') {
      const cleaned = priceAmount.replace(/[^\d.]/g, '');
      return parseFloat(cleaned);
    }
    return NaN;
  }
}
