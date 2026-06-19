/**
 * NextLevel PC Scraper — scrapes PC component prices from nextlevelpc.ma
 *
 * nextlevelpc.ma is a PrestaShop store. The HTML category pages are slow
 * (multiple pages, 200ms delays between each). The PrestaShop AJAX endpoint
 * returns all products in a single JSON response:
 *
 *   GET /<category-slug>?ajax=1&action=updateProductList&resultsPerPage=1000
 *
 * Response fields used:
 *   products[].name          — product name
 *   products[].price_amount  — price in MAD (already numeric)
 *   products[].url           — product URL
 *   products[].add_to_cart_url — absent for OOS products
 *   products[].cover.bySize.large_default.url — product image
 *   pagination.pages_count   — always 1 with resultsPerPage=1000
 *
 * TTFB: ~5-9s per category (vs ~200ms × N pages with HTML scraping).
 * All 8 categories run in parallel → total ~10s instead of ~2min.
 *
 * Requirements: 6.1, 6.2, 6.3
 */


import type { ScrapedPrice } from './baseScraper.js';
import { getRetryDelay } from './baseScraper.js';

const SITE_NAME = 'nextlevelpc.ma';
const BASE_URL = 'https://nextlevelpc.ma';

const CATEGORY_PATHS: string[] = [
  '165-processeur',
  '144-carte-graphique-video-gpu',
  '169-carte-mere',
  '181-memoire-ram',
  '250-disques-durs',
  '179-alimentation-pc-psu',
  '253-boitier-gamer',
  '269-cpu-cooler',
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'fr-MA,fr;q=0.8,en-US;q=0.5,en;q=0.3',
  'Accept-Encoding': 'gzip, deflate, br',
  'X-Requested-With': 'XMLHttpRequest',
  'Connection': 'keep-alive',
};

interface PsProduct {
  id_product: number;
  name: string;
  price_amount: number;
  add_to_cart_url?: string;
  url: string;
  cover?: {
    bySize?: {
      large_default?: { url: string };
      home_default?: { url: string };
    };
  };
  images?: {
    bySize?: {
      large_default?: { url: string };
    };
  }[];
}

interface PsResponse {
  products: PsProduct[];
  pagination: { pages_count: number; current_page: number; total_items: number };
}

// ── Dependency injection ──────────────────────────────────────────────────────

type FetchFn = (url: string, init?: any) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
let _fetch: FetchFn = fetch as unknown as FetchFn;

export function setNextLevelFetch(mockFetch: FetchFn): void {
  _fetch = mockFetch;
}

export function resetNextLevelFetch(): void {
  _fetch = fetch as unknown as FetchFn;
}

// ── Scraper ───────────────────────────────────────────────────────────────────

export class NextLevelScraper {
  private retailerId: number = 0;
  private seenIds = new Set<number>();

  async scrapeAllCategories(retailer_id: number): Promise<ScrapedPrice[]> {
    this.retailerId = retailer_id;
    this.seenIds.clear();

    // Parallel with staggered start to prevent triggering Cloudflare rate limits.
    const results = await Promise.allSettled(
      CATEGORY_PATHS.map(async (path, index) => {
        if (index > 0) {
          const delay = getRetryDelay(1000);
          if (delay > 0) await new Promise(r => setTimeout(r, index * delay));
        }
        return this.scrapeCategory(path);
      })
    );

    const allPrices: ScrapedPrice[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allPrices.push(...result.value);
      } else {
        console.error(`[${SITE_NAME}] Category failed: ${result.reason}`);
      }
    }
    if (allPrices.length === 0) {
      throw new Error(`Scraped 0 products (possible Cloudflare block or site change)`);
    }
    return allPrices;
  }

  private async scrapeCategory(path: string): Promise<ScrapedPrice[]> {
    const prices: ScrapedPrice[] = [];
    let page = 1;

    while (true) {
      const url = `${BASE_URL}/${path}?ajax=1&action=updateProductList&resultsPerPage=1000${page > 1 ? `&page=${page}` : ''}`;
      const data = await this.fetchPage(url, path);

      if (!data.products?.length) break;

      for (const p of data.products) {
        if (this.seenIds.has(p.id_product)) continue;
        this.seenIds.add(p.id_product);

        if (!p.price_amount || p.price_amount <= 0) continue;

        // Skip bundles
        if (p.name.includes('+')) continue;

        const in_stock = !!p.add_to_cart_url;

        const image_url =
          p.cover?.bySize?.large_default?.url ??
          p.cover?.bySize?.home_default?.url ??
          undefined;

        const image_urls = p.images
          ?.map(img => img.bySize?.large_default?.url)
          .filter((url): url is string => !!url)
          .slice(0, 5) || [];

        prices.push({
          retailer_id: this.retailerId,
          price: p.price_amount,
          in_stock,
          product_url: p.url,
          product_name: p.name,
          image_url,
          image_urls: image_urls.length > 0 ? image_urls : (image_url ? [image_url] : []),
        });
      }

      const totalPages = data.pagination?.pages_count ?? 1;
      if (page >= totalPages) break;
      page++;

      const delay = getRetryDelay(200);
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
    }

    return prices;
  }

  private async fetchPage(url: string, refererPath: string): Promise<PsResponse> {
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await _fetch(url, {
          signal: controller.signal,
          headers: {
            ...HEADERS,
            'Referer': `${BASE_URL}/${refererPath}`,
          },
        });
        
        if (!res.ok) {
          await res.text().catch(() => {});
          throw new Error(`HTTP ${res.status} fetching ${url}`);
        }
        
        const text = await res.text();
        return JSON.parse(text) as PsResponse;
      } catch (err) {
        const isHttp = err instanceof Error && err.message.startsWith('HTTP ');
        if (isHttp || attempt === MAX_RETRIES) throw err;
        const delay = getRetryDelay(Math.pow(2, attempt) * 1000);
        await new Promise(r => setTimeout(r, delay));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error('Unreachable');
  }
}
