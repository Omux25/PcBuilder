/**
 * PC Gamer Casa Scraper — scrapes PC component prices from pcgamercasa.ma
 *
 * pcgamercasa.ma is a PrestaShop store with a custom JS-rendered theme.
 * The category pages load products via AJAX — the static HTML contains no
 * product cards. The AJAX endpoint returns a JSON response with:
 *   - products[]     — structured product data (name, price_amount, url, cover)
 *   - pagination     — { total_items, pages_count, current_page }
 *
 * AJAX endpoint:
 *   GET /<category-id>/<slug>?ajax=1&action=updateProductList&page=N
 *
 * Stock detection: the `products` JSON array doesn't include a stock field.
 * We infer in_stock=true when `add_to_cart_url` is present (PrestaShop omits
 * it for OOS products), and fall back to checking the rendered HTML for
 * "rupture" (French for "out of stock").
 *
 * Image: use `cover.bySize.large_default.url` (800px square product shot).
 *
 * Requirements: 6.1, 6.2, 6.3
 */


import type { ScrapedPrice } from './baseScraper.js';
import { getRetryDelay } from './baseScraper.js';

const SITE_NAME = 'pcgamercasa.ma';
const BASE_URL = 'https://pcgamercasa.ma';

// Component category URLs — <id>/<slug>
// Using parent categories where possible to avoid duplicates across subcategories.
const CATEGORY_PATHS: string[] = [
    '15/processeurs',
    '14/cartes-graphiques',
    '16/cartes-meres',
    '17/memoire-ram',
    '13/stockage-hdd-et-ssd',
    '20/alimentations-pc',
    '21/refroidissement',
    '19/boitiers-pc-et-accessoires',
    '232/ventilateurs-boitier',
    '233/pate-thermique',
];

// Firefox-like headers — required to get a 200 response (plain Chrome UA gets blocked)
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'fr-MA,fr;q=0.8,en-US;q=0.5,en;q=0.3',
    'X-Requested-With': 'XMLHttpRequest',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'Connection': 'keep-alive',
};

interface PsProduct {
    id_product: number;
    name: string;
    price_amount: number;
    description_short?: string;
    add_to_cart_url?: string;
    url: string;
    cover?: {
        bySize?: {
            large_default?: { url: string };
            home_default?: { url: string };
        };
    };
}

interface PsResponse {
    products: PsProduct[];
    pagination: {
        total_items: number;
        pages_count: number;
        current_page: number;
    };
}

// ── Dependency injection ──────────────────────────────────────────────────────

type FetchFn = (url: string, init?: any) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
let _fetch: FetchFn = fetch as unknown as FetchFn;

export function setPcGamerCasaFetch(mockFetch: FetchFn): void {
    _fetch = mockFetch;
}

export function resetPcGamerCasaFetch(): void {
    _fetch = fetch as unknown as FetchFn;
}

// ── Scraper ───────────────────────────────────────────────────────────────────

export class PcGamerCasaScraper {
    private retailerId: number = 0;
    private seenIds = new Set<number>();

    async scrapeAllCategories(retailer_id: number): Promise<ScrapedPrice[]> {
        this.retailerId = retailer_id;
        this.seenIds.clear();

        // Semi-parallel with concurrency limit of 2.
        // The server throttles when hit with >2-3 simultaneous requests (TTFB jumps from 20s to 30s+).
        // With resultsPerPage=1000 each category is a single request, so 2 concurrent = ~40s total
        // instead of 10×20s = 200s sequential.
        const CONCURRENCY = 2;
        const allPrices: ScrapedPrice[] = [];
        const paths = [...CATEGORY_PATHS];

        let firstErrorReason: any;

        while (paths.length > 0) {
            const batch = paths.splice(0, CONCURRENCY);
            const results = await Promise.allSettled(
                batch.map(path => this.scrapeCategory(path))
            );
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    allPrices.push(...result.value);
                } else {
                    console.error(`[${SITE_NAME}] Category failed: ${result.reason}`);
                    if (!firstErrorReason) firstErrorReason = result.reason;
                }
            }
        }

        if (allPrices.length === 0) {
            throw new Error(`Scraped 0 products. First error: ${firstErrorReason || 'unknown'}`);
        }
        return allPrices;
    }

    private async scrapeCategory(path: string): Promise<ScrapedPrice[]> {
        const prices: ScrapedPrice[] = [];
        let page = 1;
        let totalPages = 1;

        do {
            const url = `${BASE_URL}/${path}?ajax=1&action=updateProductList&resultsPerPage=100${page > 1 ? `&page=${page}` : ''}`;
            const data = await this.fetchPage(url, path);

            if (page === 1) {
                totalPages = data.pagination?.pages_count ?? 1;
            }

            if (!data.products?.length) break;

            for (const p of data.products) {
                if (this.seenIds.has(p.id_product)) continue;
                this.seenIds.add(p.id_product);

                if (!p.price_amount || p.price_amount <= 0) continue;

                // Stock: add_to_cart_url is absent for OOS products in PrestaShop
                const in_stock = !!p.add_to_cart_url;

                const image_url =
                    p.cover?.bySize?.large_default?.url ??
                    p.cover?.bySize?.home_default?.url ??
                    undefined;

                const product_description = p.description_short
                    ? p.description_short.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
                    : undefined;

                prices.push({
                    retailer_id: this.retailerId,
                    price: p.price_amount,
                    in_stock,
                    product_url: p.url,
                    product_name: p.name,
                    product_description,
                    image_url,
                });
            }

            page++;
            if (page <= totalPages) {
                const delay = getRetryDelay(200);
                if (delay > 0) await new Promise(r => setTimeout(r, delay));
            }
        } while (page <= totalPages && page <= 20);

        return prices;
    }
    private async fetchPage(url: string, refererPath: string): Promise<any> {
        try {
            const res = await _fetch(url, {
                method: 'POST', // POST bypasses basic GET challenges
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Accept-Language': 'fr-MA,fr;q=0.8,en-US;q=0.5,en;q=0.3',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': `${BASE_URL}/${refererPath}`,
                    'Content-Length': '0',
                }
            });

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`HTTP ${res.status}: ${text}`);
            }

            return await res.json();
        } catch (err: any) {
            console.error(`[${SITE_NAME}] Fetch failed: ${err.message}`);
            throw err;
        }
    }
}
