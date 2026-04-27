/**
 * Abstract base scraper.
 *
 * Handles the common HTTP fetch + HTML parse logic.
 * Site-specific scrapers extend this class and implement `extractPrices()`.
 *
 * Usage:
 *   class MyScraper extends BaseScraper {
 *     constructor() { super('mysite.ma'); }
 *     protected extractPrices($: CheerioAPI): ScrapedPrice[] { ... }
 *   }
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { fetch } from 'undici';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * One price record extracted from a retailer page.
 * The aggregator will UPSERT this into the `prices` table.
 */
export interface ScrapedPrice {
  /** Foreign key — must match an existing row in `components.id` */
  component_id: number;
  /** Foreign key — must match an existing row in `retailers.id` */
  retailer_id: number;
  /** Price in MAD (Moroccan Dirham) */
  price: number;
  /** Whether the product is currently in stock */
  in_stock: boolean;
  /** Direct URL to the product page on the retailer site */
  product_url: string;
}

// ── Dependency injection ──────────────────────────────────────────────────────
// `_fetch` and `_load` can be replaced in tests to avoid real HTTP calls.

type FetchFn = (url: string, init?: RequestInit) => Promise<{ text: () => Promise<string>; ok: boolean; status: number }>;
type LoadFn  = (html: string) => CheerioAPI;

let _fetch: FetchFn = fetch as unknown as FetchFn;
let _load:  LoadFn  = cheerio.load;

/** Replace the fetch function — used in unit tests. */
export function setFetch(mockFetch: FetchFn): void {
  _fetch = mockFetch;
}

/** Replace the cheerio load function — used in unit tests. */
export function setLoad(mockLoad: LoadFn): void {
  _load = mockLoad;
}

/** Reset both to their real implementations. */
export function resetFetchAndLoad(): void {
  _fetch = fetch as unknown as FetchFn;
  _load  = cheerio.load;
}

// ── Base class ────────────────────────────────────────────────────────────────

export abstract class BaseScraper {
  /** Human-readable site name — used in log entries (e.g. 'site1.ma') */
  readonly siteName: string;

  constructor(siteName: string) {
    this.siteName = siteName;
  }

  /**
   * Fetches the target URL, parses the HTML, and returns extracted prices.
   *
   * Throws on HTTP errors (non-2xx) or network failures.
   * The scheduler catches these and logs them — one broken site never
   * stops the rest of the session.
   *
   * @param url - The page URL to scrape
   */
  async scrape(url: string): Promise<ScrapedPrice[]> {
    const response = await _fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }

    const html = await response.text();
    const $    = _load(html);

    return this.extractPrices($);
  }

  /**
   * Extracts price records from the parsed HTML.
   * Implemented by each site-specific scraper.
   *
   * @param $ - Cheerio API loaded with the page HTML
   */
  protected abstract extractPrices($: CheerioAPI): ScrapedPrice[];
}
