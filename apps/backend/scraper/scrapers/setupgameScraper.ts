/**
 * SetupGame Scraper — scrapes PC component prices from setupgame.ma
 *
 * setupgame.ma is a WooCommerce store. The HTML category pages are now
 * protected by Cloudflare (HTTP 403 for all bot-like requests), but the
 * WooCommerce Store API (/wp-json/wc/store/v1/products) is publicly accessible
 * and returns full product data as JSON — no auth required.
 *
 * API endpoint:
 *   GET /wp-json/wc/store/v1/products?category_id=<id>&per_page=100&page=N
 *
 * Response fields used:
 *   name          — product name
 *   permalink     — product URL
 *   prices.price  — price in centimes (divide by 100 to get MAD)
 *   is_in_stock   — boolean stock status
 *   images[0].src — product image URL
 *
 * Category IDs (verified from /wp-json/wc/store/v1/products/categories):
 *   Processeurs subcategories: 1579, 1564, 1412, 1593, 1644 (Intel gens), 1726, 1555, 1369, 1457 (AM4), 1784, 1783, 1782 (AM5)
 *   Carte Graphique: 224 (RTX), 237 (GTX), 2871 (GT), 3067 (Radeon), 3068 (Arc)
 *   Carte Mère: 144, 131, 1345, 1795, 152, 1591, 3442, 134
 *   RAM: 246 (parent — covers DDR4 + DDR5)
 *   Stockage: 270 (parent), 271 (HDD), SSD subcategory
 *   PSU: 318
 *   Boitier: 347
 *   Aircooler: 295
 *   Watercooler: 85 subcategory (fetched via parent search)
 *   Pâte thermique: fetched via parent composants-gaming
 *   Ventilateurs: fetched via parent composants-gaming
 *
 * Requirements: 6.1, 6.2, 6.3
 */

import { fetch } from 'undici';
import type { ScrapedPrice } from './baseScraper.js';
import { getRetryDelay } from './baseScraper.js';

const SITE_NAME = 'setupgame.ma';
const BASE_API = 'https://setupgame.ma/wp-json/wc/store/v1/products';
const PER_PAGE = 100;

// ── Dependency injection ──────────────────────────────────────────────────────
// Allows tests to inject a mock fetch without making real HTTP calls.

type FetchFn = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;
let _fetch: FetchFn = fetch as unknown as FetchFn;

export function setSetupGameFetch(mockFetch: FetchFn): void {
  _fetch = mockFetch;
}

export function resetSetupGameFetch(): void {
  _fetch = fetch as unknown as FetchFn;
}

// Category slugs — verified against /wp-json/wc/store/v1/products?category=<slug>
// These are the WooCommerce category slugs, NOT the URL path segments.
const CATEGORY_SLUGS: string[] = [
  // Processeurs — Intel socket subcategories
  'processeurs-socket-1151',
  'processeurs-socket-1200',
  'processeurs-socket-1700',
  'processeurs-socket-1851',
  // Processeurs — AMD AM4 (by Ryzen tier to avoid duplicates)
  'am4-ryzen-3',
  'am4-ryzen-5',
  'am4-ryzen-7',
  'am4-ryzen-9',
  // Processeurs — AMD AM5
  'am5-ryzen-5',
  'am5-ryzen-7',
  'am5-ryzen-9',
  // Processeurs — AMD AM4 parent (catches Threadripper + anything not in tier subcats)
  'processeurs-socket-am4',
  'processeurs-socket-am5',
  // Carte Graphique
  'geforce-rtx',
  'geforce-gtx',
  'geforce-gt',
  'amd-radeon',
  'intel-arc',
  // Carte Mère
  'cartes-meres-socket-1151',
  'cartes-meres-socket-1200',
  'cartes-meres-socket-1700',
  'cartes-meres-socket-1851',
  'cartes-meres-socket-am4',
  'cartes-meres-socket-am5',
  'cartes-meres-socket-amd-str5',
  'cartes-meres-socket-amd-tr4',
  // RAM (parent covers DDR4 + DDR5 in one call)
  'memoire-vive-pc-ram',
  // Stockage
  'ssd',
  'hdd',
  // PSU
  'blocs-dalimentation',
  // Boitier
  'boitier-gamer',
  // Cooling
  'aircooler',
  'watercooler',
  // Thermal paste + fans
  'pate-thermique',
  'ventilateurs-boitier',
];

// Firefox-like headers — bypasses Cloudflare on the API endpoint
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'fr-MA,fr;q=0.8,en-US;q=0.5,en;q=0.3',
  'Accept-Encoding': 'gzip, deflate, br',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'Connection': 'keep-alive',
};

interface StoreApiProduct {
  id: number;
  name: string;
  type: string;
  permalink: string;
  prices: { price: string; regular_price: string };
  is_in_stock: boolean;
  images: { src: string }[];
  short_description?: string;
}

export class SetupGameScraper {
  private retailerId: number = 0;
  // Deduplicate by product ID across category fetches
  private seenIds = new Set<number>();

  async scrapeAllCategories(retailer_id: number): Promise<ScrapedPrice[]> {
    this.retailerId = retailer_id;
    this.seenIds.clear();
    const allPrices: ScrapedPrice[] = [];

    for (const slug of CATEGORY_SLUGS) {
      try {
        const prices = await this.fetchCategory(`category=${slug}`);
        allPrices.push(...prices);
      } catch (err) {
        console.error(`[${SITE_NAME}] Category "${slug}" failed: ${err}`);
      }
      const delay = getRetryDelay(200);
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
    }

    return allPrices;
  }

  private async fetchCategory(categoryParam: string): Promise<ScrapedPrice[]> {
    const prices: ScrapedPrice[] = [];
    let page = 1;

    while (true) {
      const url = `${BASE_API}?${categoryParam}&per_page=${PER_PAGE}&page=${page}`;
      const products = await this.fetchPage(url);
      if (products.length === 0) break;

      for (const p of products) {
        // Skip bundles / complete PC builds
        if (p.type === 'bundle' || p.type === 'grouped') continue;
        if (p.name.toLowerCase().includes('pc gamer') || p.name.includes('+')) continue;
        // Deduplicate
        if (this.seenIds.has(p.id)) continue;
        this.seenIds.add(p.id);

        const priceRaw = parseInt(p.prices?.price ?? '0', 10);
        if (!priceRaw || priceRaw <= 0) continue;
        const price = priceRaw / 100; // centimes → MAD

        prices.push({
          retailer_id: this.retailerId,
          price,
          in_stock: p.is_in_stock,
          product_url: p.permalink,
          product_name: p.name,
          image_url: p.images?.[0]?.src ?? undefined,
        });
      }

      if (products.length < PER_PAGE) break; // last page
      page++;

      const delay = getRetryDelay(150);
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
    }

    return prices;
  }

  private async fetchPage(url: string): Promise<StoreApiProduct[]> {
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await _fetch(url, {
          signal: controller.signal,
          headers: HEADERS,
        });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
        return await res.json() as StoreApiProduct[];
      } catch (err) {
        clearTimeout(timeout);
        const isHttp = err instanceof Error && err.message.startsWith('HTTP ');
        if (isHttp || attempt === MAX_RETRIES) throw err;
        const delay = getRetryDelay(Math.pow(2, attempt) * 1000);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error('Unreachable');
  }
}
