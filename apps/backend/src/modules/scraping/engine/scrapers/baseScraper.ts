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
  /** Foreign key — must match an existing row in `retailers.id` */
  retailer_id: number;
  /** Price in MAD (Moroccan Dirham) */
  price: number;
  /** Whether the product is currently in stock */
  in_stock: boolean;
  /** Direct URL to the product page on the retailer site */
  product_url: string;
  /** Optional: scraped product name — used for unmatched_listings and variant extraction */
  product_name?: string;
  /** Optional: short description from the retailer — used as fallback for variant extraction
   *  when the product name doesn't contain enough detail (e.g. VRAM size) */
  product_description?: string;
  /** Optional: Manually assigned category for reprocessing */
  manual_category?: string;
  /** Optional: Product image URL from the retailer */
  image_url?: string;
  /** Optional: Multiple product image URLs (e.g. gallery shots) */
  image_urls?: string[];
  /** Optional: Manufacturer Part Number extracted from retailer */
  mpn?: string;
  /** Optional: European Article Number (Barcode) extracted from retailer */
  ean?: string;
}

// ── Dependency injection ──────────────────────────────────────────────────────
// `_fetch` and `_load` can be replaced in tests to avoid real HTTP calls.

type FetchFn = (url: string, init?: RequestInit) => Promise<{ text: () => Promise<string>; ok: boolean; status: number }>;
type LoadFn = (html: string) => CheerioAPI;

let _fetch: FetchFn = fetch as unknown as FetchFn;
let _load: LoadFn = cheerio.load;
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

/** Returns the current retry delay — used by subclasses for inter-page delays. */
export function getRetryDelay(defaultMs: number): number {
  return _retryDelayMs !== null ? _retryDelayMs : defaultMs;
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
  _load = cheerio.load;
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
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s per request
        try {
          const response = await _fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'fr-MA,fr;q=0.9,en;q=0.8',
          },
        } as RequestInit);

        // HTTP errors are not retried — throw immediately
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} fetching ${url}`);
        }

        const html = await response.text();
        const $ = _load(html);
        return this.extractPrices($);
      } catch (err) {
        const isHttpError = err instanceof Error && err.message.startsWith('HTTP ');

        // Don't retry HTTP errors — only network/timeout failures
        if (isHttpError || attempt === MAX_RETRIES) {
          throw err;
        }

        const delayMs = _retryDelayMs !== null ? _retryDelayMs : Math.pow(2, attempt) * 1000; // 2s, 4s
        if (!_silent) {
          // Use console.warn for retry messages — they're transient and the logger
          // is async (writes to DB). A fire-and-forget logger call here would
          // complicate the retry flow without adding meaningful value.
          console.warn(
            `[${this.siteName}] Attempt ${attempt}/${MAX_RETRIES} failed: ${(err as Error).message}. Retrying in ${delayMs}ms...`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } finally {
        clearTimeout(timeout);
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
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await _fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'fr-MA,fr;q=0.9,en;q=0.8',
          },
        } as RequestInit);

        // Retry on 503 (rate limit / server overload) with backoff
        if (response.status === 503) {
          if (attempt === MAX_RETRIES) throw new Error(`HTTP 503 fetching ${url}`);
          const delayMs = _retryDelayMs !== null ? _retryDelayMs : attempt * 3000; // 3s, 6s
          if (!_silent) console.warn(`[${this.siteName}] 503 on ${url} — retrying in ${delayMs}ms (attempt ${attempt}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
        const html = await response.text();
        return _load(html);
      } catch (err) {
        // If it's the last attempt, or an HTTP error other than 503, throw it
        const isHttpError = err instanceof Error && err.message.startsWith('HTTP ');
        if (attempt === MAX_RETRIES || (isHttpError && !err.message.includes('503'))) {
          throw err;
        }
        
        // For network errors, retry with exponential backoff
        const delayMs = _retryDelayMs !== null ? _retryDelayMs : Math.pow(2, attempt) * 1000;
        if (!_silent) console.warn(`[${this.siteName}] Network error on ${url} — retrying in ${delayMs}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error('Unreachable');
  }
}
