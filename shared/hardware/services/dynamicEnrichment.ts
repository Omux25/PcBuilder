/**
 * dynamicEnrichment.ts
 *
 * Handles missing hardware specifications by checking a local cache
 * (hardware_knowledge_cache) and falling back to a Lazy Deep Scraper
 * (injected at call-site to avoid shared→backend coupling).
 *
 * The deep scraper is passed in as an optional function parameter so that the
 * shared package never has a hard import dependency on the backend scraping layer.
 */

export interface ResolvedSpecs {
  mpn?: string | null;
  ean?: string | null;
  length_mm?: number | null;
  vram_gb?: number | null;
  tdp?: number | null;
  form_factors?: string[] | null;
  max_gpu_length_mm?: number | null;
  max_cpu_cooler_height_mm?: number | null;
  wattage?: number | null;
  efficiency_rating?: string | null;
  modular?: string | null;
  psu_form_factor?: string | null;
  [key: string]: unknown;
}

/**
 * Interface for the cache storage.
 * Passed in to avoid direct DB dependencies in shared code.
 */
export interface HardwareCache {
  get(queryString: string): Promise<ResolvedSpecs | null>;
  set(queryString: string, hardwareType: string, specs: ResolvedSpecs): Promise<void>;
}

/**
 * Optional injected deep-scraper function.
 * Backend code passes `scrapeProductPage` from deepScraper.ts here.
 * Shared code itself never imports the backend scraping layer directly.
 */
export type DeepScraperFn = (url: string, category: string) => Promise<ResolvedSpecs | null>;

/**
 * Main entry point for dynamic hardware enrichment.
 *
 * Resolution order:
 *   1. Cache (by name)
 *   2. Specifications/Identifiers Extraction (Deep Scraper)
 */
export async function getDynamicEnrichment(
  queryString: string,
  hardwareType: string,
  cache: HardwareCache,
  productUrl?: string,
  deepScraper?: DeepScraperFn,
): Promise<ResolvedSpecs | null> {

  // ── Step 1: Check the knowledge cache by string ───────────────────────────
  const cached = await cache.get(queryString);
  if (cached) return cached;

  // ── Step 2: Try to extract specs/identifiers from the product page ────────
  if (productUrl && deepScraper) {
    try {
      const deepSpecs = await deepScraper(productUrl, hardwareType);
      if (deepSpecs) {
        await cache.set(queryString, hardwareType, deepSpecs);
        return deepSpecs;
      }
    } catch (err) {
      console.error(`[DynamicEnrichment] Spec extraction failed for ${productUrl}:`, err);
    }
  }

  // ── Step 3: Log for manual resolution ─────────────────────────────────────
  console.log(`[MISSING_CACHE_FLAG:${hardwareType.toUpperCase()}] Manual resolution needed for: "${queryString}"`);

  return null;
}
