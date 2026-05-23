/**
 * dynamicEnrichment.ts
 *
 * Handles missing hardware specifications by checking a local cache
 * (hardware_knowledge_cache) and falling back through two layers:
 *
 *   1. LLM API  (currently mocked / commented-out — requires API key)
 *   2. Lazy Deep Scraper  (injected at call-site to avoid shared→backend coupling)
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
 *   2. Identifiers Extraction (Deep Scraper) → if found, re-check Cache (by ID)
 *   3. LLM (enriched with extracted IDs)
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

  let extractedIds: { mpn?: string | null; ean?: string | null } = {};

  // ── Step 2: Try to extract identifiers from the product page first ────────
  // This gives the LLM the exact MPN/EAN to work with for 100% accuracy.
  if (productUrl && deepScraper) {
    try {
      const deepSpecs = await deepScraper(productUrl, hardwareType);
      if (deepSpecs) {
        // If we found a full spec match, we're done
        const hasSpecs = Object.keys(deepSpecs).some(
          k => k !== 'mpn' && k !== 'ean' && deepSpecs[k] !== null && deepSpecs[k] !== undefined
        );
        if (hasSpecs) {
          await cache.set(queryString, hardwareType, deepSpecs);
          return deepSpecs;
        }
        // Otherwise, keep the IDs for the LLM step
        extractedIds = { mpn: deepSpecs.mpn, ean: deepSpecs.ean };
      }
    } catch (err) {
      console.error(`[DynamicEnrichment] ID extraction failed for ${productUrl}:`, err);
    }
  }

  // ── Step 3: LLM fallback (now with identifiers) ───────────────────────────
  const llmSpecs = await fetchLlmSpecs(queryString, hardwareType, extractedIds.mpn, extractedIds.ean);

  if (llmSpecs) {
    // Merge extracted IDs into LLM result if LLM didn't return them
    const finalSpecs = {
      ...llmSpecs,
      mpn: llmSpecs.mpn || extractedIds.mpn,
      ean: llmSpecs.ean || extractedIds.ean,
    };
    await cache.set(queryString, hardwareType, finalSpecs);
    return finalSpecs;
  }

  // ── Step 4: Log for manual resolution ─────────────────────────────────────
  console.log(`[MISSING_CACHE_FLAG:${hardwareType.toUpperCase()}] Manual resolution needed for: "${queryString}"`);

  return null;
}

/**
 * Integration point for an external LLM API (e.g., Google Gemini or OpenAI).
 */
async function fetchLlmSpecs(
  queryString: string, 
  hardwareType: string, 
  mpn?: string | null, 
  ean?: string | null
): Promise<ResolvedSpecs | null> {
  try {
    const idFragment = mpn || ean 
      ? `IDENTIFIERS: ${mpn ? `MPN=${mpn}` : ''} ${ean ? `EAN=${ean}` : ''}. Use these for deterministic matching.`
      : '';

    const prompt = `You are a hardware expert. Identify the exact PC component using this Query String or Identifiers.
${idFragment}
QUERY: "${queryString}"
CATEGORY: "${hardwareType}"

Output ONLY strict JSON. Output the definitive technical specifications for this exact model.
If category is "case", keys: form_factors (string[]), max_gpu_length_mm (number|null), max_cpu_cooler_height_mm (number|null).
If category is "ram", keys: ram_type (DDR4/DDR5), capacity_gb (number), frequency_mhz (number), kit_count (number), cas_latency (number).
If category is "motherboard", keys: socket (string), form_factor (string), chipsets (string).
If category is "psu", keys: wattage (number|null), efficiency_rating (Bronze/Gold/Platinum/Titanium/Silver/White/Standard), modular (Full/Semi/Non), psu_form_factor (ATX/SFX/SFX-L/TFX).
Otherwise, keys: length_mm (number|null), vram_gb (number|null), tdp (number|null).

Include "mpn" and "ean" keys in your response if you can confirm them.
If unknown, return null for the fields.`;

    // ── Real API call ────────────────────────────────────────────────────────
    if (!process.env.GEMINI_API_KEY) {
      console.warn('[DynamicEnrichment] No GEMINI_API_KEY found — skipping LLM');
      return null;
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!response.ok) {
      throw new Error(`LLM API returned ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    // Clean up potential markdown code blocks in LLM response
    const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error(`[DynamicEnrichment] LLM fetch error for "${queryString}":`, error);
    return null;
  }
}
