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
  /**
   * Placeholder — always set to 0 by production scrapers.
   * The aggregator resolves the real component_id from `scraper_mappings`
   * using (retailer_id, product_url) as the lookup key.
   * Only the legacy site1Scraper pattern sets this to a real value.
   */
  component_id: number;
  /** Foreign key — must match an existing row in `retailers.id` */
  retailer_id: number;
  /** Price in MAD (Moroccan Dirham) */
  price: number;
  /** Whether the product is currently in stock */
  in_stock: boolean;
  /** Direct URL to the product page on the retailer site */
  product_url: string;
  /** Optional: scraped product name — used for unmatched_listings */
  product_name?: string;
}

// ── Dependency injection ──────────────────────────────────────────────────────
// `_fetch` and `_load` can be replaced in tests to avoid real HTTP calls.

type FetchFn = (url: string, init?: RequestInit) => Promise<{ text: () => Promise<string>; ok: boolean; status: number }>;
type LoadFn  = (html: string) => CheerioAPI;

let _fetch: FetchFn = fetch as unknown as FetchFn;
let _load:  LoadFn  = cheerio.load;
let _retryDelayMs: number | null = null; // null = use default exponential backoff
let _silent = false; // suppress console.warn in tests

/** Replace the fetch function — used in unit tests. */
export function setFetch(mockFetch: FetchFn): void {
  _fetch = mockFetch;
}

/** Replace the cheerio load function — used in unit tests. */
export function setLoad(mockLoad: LoadFn): void {
  _load = mockLoad;
}

/** Override retry delay — set to 0 in tests to avoid waiting. */
export function setRetryDelay(ms: number | null): void {
  _retryDelayMs = ms;
}

/**
 * Suppress console.warn retry messages — set to true in tests to keep
 * output clean when fast-check generates random error strings.
 */
export function setSilent(silent: boolean): void {
  _silent = silent;
}

/** Reset all injected dependencies to their real implementations. */
export function resetFetchAndLoad(): void {
  _fetch = fetch as unknown as FetchFn;
  _load  = cheerio.load;
  _retryDelayMs = null;
  _silent = false;
}

// ── Base class ────────────────────────────────────────────────────────────────

export abstract class BaseScraper {
  /** Human-readable site name — used in log entries (e.g. 'site1.ma') */
  readonly siteName: string;

  constructor(siteName: string) {
    this.siteName = siteName;
  }

  /**
   * Fetches the target URL with exponential backoff retry (up to 3 attempts).
   * Only retries on network/timeout errors — HTTP errors (4xx/5xx) throw immediately.
   *
   * @param url - The page URL to scrape
   */
  async scrape(url: string): Promise<ScrapedPrice[]> {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s per request
        let response: Awaited<ReturnType<FetchFn>>;
        try {
          response = await _fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'PCBuilderMaroc-Bot/1.0 (price comparator; +https://pcbuilder.ma)' },
          } as RequestInit);
        } finally {
          clearTimeout(timeout);
        }

        // HTTP errors are not retried — throw immediately
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} fetching ${url}`);
        }

        const html = await response.text();
        const $    = _load(html);
        return this.extractPrices($);
      } catch (err) {
        const isHttpError = err instanceof Error && err.message.startsWith('HTTP ');

        // Don't retry HTTP errors — only network/timeout failures
        if (isHttpError || attempt === MAX_RETRIES) {
          throw err;
        }

        const delayMs = _retryDelayMs !== null ? _retryDelayMs : Math.pow(2, attempt) * 1000; // 2s, 4s
        if (!_silent) {
          console.warn(
            `[${this.siteName}] Attempt ${attempt}/${MAX_RETRIES} failed: ${(err as Error).message}. Retrying in ${delayMs}ms...`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw new Error('Unreachable');
  }

  /**
   * Extracts price records from the parsed HTML.
   * Implemented by each site-specific scraper.
   *
   * @param $ - Cheerio API loaded with the page HTML
   */
  protected abstract extractPrices($: CheerioAPI): ScrapedPrice[];

  /**
   * Fetches a URL and returns the parsed Cheerio object.
   * Useful when a subclass needs to extract additional data (e.g. pagination)
   * from the same HTML without calling scrape() twice.
   */
  protected async fetchAndParse(url: string): Promise<CheerioAPI> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response: Awaited<ReturnType<FetchFn>>;
    try {
      response = await _fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'PCBuilderMaroc-Bot/1.0 (price comparator; +https://pcbuilder.ma)' },
      } as RequestInit);
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
    const html = await response.text();
    return _load(html);
  }
}
