/**
 * catalogBuilder.ts — Auto-creates catalog entries from scraped product names.
 *
 * Called after autoMap() for listings that couldn't be matched to any existing
 * catalog entry. Supports: CPU, GPU, RAM, storage, motherboard, PSU, AIO cooling, case.
 *
 * Fix 1: Motherboard chipset regex extended to include M/D/F suffixes (A520M, B550M, H610M)
 * Fix 2: PSU auto-creation enabled — wattage reliably extractable from name
 * Fix 3: AIO cooling auto-creation enabled — size reliably extractable
 * Fix 4: Case auto-creation enabled — form factor extractable, max_gpu_length defaulted
 * Fix 5: HTML entity decoding before processing (&#8211; → –, &rsquo; → ', etc.)
 */

import { componentSlug, generateUniqueSlug } from '@shared/slugify';
import { scoreDnaMatch, extractDna, type CatalogComponent } from '../../../core/utils/componentMatcher.js';
import { logger } from './utils/logger.js';
import { getSql, setSql, resetSql } from '../../../core/db/index.js';
import {
  decodeHtml
} from '@shared/decode-html';
import {
  inferCategory, inferCategoryFromUrl
} from '@shared/hardware/categories';
import {
  extractBrand
} from '@shared/hardware/brands';
import {
  cleanName, CATEGORY_WORDS
} from '@shared/hardware/cleaning';
import { extractCpuSpecs } from '@shared/hardware/specs/cpu';
import { extractGpuSpecs } from '@shared/hardware/specs/gpu';
import { extractRamSpecs } from '@shared/hardware/specs/ram';
import { extractMotherboardSpecs } from '@shared/hardware/specs/motherboard';
import { extractPsuSpecs, normalizeEfficiencyRating, normalizeModularity, normalizePsuFormFactor } from '@shared/hardware/specs/psu';
import { extractCoolingSpecs } from '@shared/hardware/specs/cooling';
import { extractCaseSpecs } from '@shared/hardware/specs/case';
import { extractFanSpecs } from '@shared/hardware/specs/fan';
import { extractThermalPasteSpecs } from '@shared/hardware/specs/thermal-paste';
import { extractStorageSpecs } from '@shared/hardware/specs/storage';
import type { ComponentCategory } from '@shared/types';
import { loadAdminRules, matchesRule, type KeywordRule } from '../services/keywordRulesService.js';
import { getDynamicEnrichment } from '@shared/hardware/services/dynamicEnrichment';
import { dbHardwareCache } from '../services/dynamicEnrichmentService.js';
import { scrapeProductPage } from '../utils/deepScraper.js';

// ── Case Negative Keyword Guard ───────────────────────────────────────────────
// Any product title matching one of these keywords must NOT be categorised as a
// PC case.  The guard fires in resolveCategory() and inside the case insertion
// branch to permanently block cooling accessories from entering the case catalog.
const CASE_NEGATIVE_KEYWORDS: Array<{
  keywords: string[];
  redirect: ComponentCategory;  // where to send pollutants instead
}> = [
  {
    keywords: ['aio', 'watercooling', 'watercooler', 'water cooler', 'liquid freezer', 'liquid cooling', 'refroidissement liquide'],
    redirect: 'cooling',
  },
  {
    keywords: ['cooler', 'refroidisseur', 'ventirad', 'cpu cooler', 'air cooler'],
    redirect: 'cooling',
  },
  {
    keywords: ['pate thermique', 'pâte thermique', 'thermal paste', 'thermal compound', 'thermal grease'],
    redirect: 'thermal_paste',
  },
  {
    keywords: ['hub', 'fan hub', 'rgb hub', 'argb hub'],
    redirect: 'fan',
  },
  {
    keywords: ['fan', 'ventilateur', 'argb', 'pwm', 'liquid'],
    redirect: 'fan',
  },
];

/**
 * Returns the correct ComponentCategory if the name is a cooling/fan accessory
 * that was misidentified as a case, or `null` if the name is a legitimate case.
 *
 * Call this before assigning category = 'case'.
 */
function getCasePollutantRedirect(name: string): ComponentCategory | null {
  const lower = name.toLowerCase();
  for (const rule of CASE_NEGATIVE_KEYWORDS) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule.redirect;
    }
  }
  return null;
}

// Re-export DI helpers so tests can inject a mock SQL function.
export { setSql, resetSql };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BuildResult {
  created: number;
  skipped: number;
}

// ── Main catalog builder ──────────────────────────────────────────────────────

/**
 * For each pending unmatched listing that couldn't be matched by autoMap(),
 * attempts to extract specs from the product name and create a new catalog entry.
 */
export async function buildFromUnmatched(onProgress?: (done: number, total: number) => void): Promise<BuildResult> {
  let created = 0;
  let skipped = 0;

  const sql = getSql();

  // Load admin keyword rules once — used to categorize listings that inferCategory() misses
  // (e.g. "Hyte Y70" has no generic case keyword, but an admin rule maps "Y70" → case)
  let adminRules: KeywordRule[] = [];
  try {
    adminRules = await loadAdminRules();
  } catch { /* non-critical — fall back to inferCategory only */ }

  /**
   * Resolves the category for a scraped name.
   * Admin keyword rules take priority over the built-in inferCategory logic,
   * so that admin-configured mappings (e.g. "Y70" → case) are always respected.
   */
  function resolveCategory(name: string): ComponentCategory | null {
    for (const rule of adminRules) {
      if (matchesRule(rule, name)) {
        // Even admin rules cannot override the case negative keyword guard —
        // if an admin mapped something to 'case' but its title contains a
        // cooling keyword, redirect it to the appropriate cooling category.
        const adminCat = rule.category as ComponentCategory;
        if (adminCat === 'case') {
          const redirect = getCasePollutantRedirect(name);
          if (redirect) return redirect;
        }
        return adminCat;
      }
    }
    const cat = inferCategory(name);
    if (cat === 'build' || cat === 'bundle') return null;
    // ── Case Negative Keyword Guard ──────────────────────────────────────────
    // If inferCategory() decided this is a 'case' but the product title
    // contains a cooling/fan keyword, redirect it immediately.
    if (cat === 'case') {
      const redirect = getCasePollutantRedirect(name);
      if (redirect) return redirect;
    }
    return cat as ComponentCategory | null;
  }

  const pending = (await sql`
    SELECT ul.id, ul.retailer_id, ul.product_url, ul.scraped_name, ul.scraped_price, ul.image_url,
           us.category AS suggestion_category
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    WHERE ul.status = 'pending'
      AND ul.scraped_name IS NOT NULL
      AND ul.scraped_name != ''
    ORDER BY ul.scraped_at DESC
  `) as { id: number; retailer_id: number; product_url: string; scraped_name: string; scraped_price: number; image_url: string | null; suggestion_category: string | null }[];

  if (pending.length === 0) return { created, skipped };

  const existingSlugsRows = (await sql`SELECT slug FROM components WHERE slug IS NOT NULL`) as { slug: string }[];
  const existingSlugs = new Set(existingSlugsRows.map(r => r.slug));

  const existingComponents = (await sql`
    SELECT id, name, brand, category FROM components WHERE is_active = true
  `) as CatalogComponent[];

  for (const listing of pending) {
    const scrapedName = decodeHtml(listing.scraped_name);

    // Strip category prefix before extracting brand/name
    // e.g. "Watercooler – Lian Li Galahad 240" → "Lian Li Galahad 240"
    // e.g. "DeepCool – Matrexx 55 V3" → "Matrexx 55 V3" (brand extracted from prefix)
    const prefixMatch = scrapedName.match(/^([^–\-]+)[–\-]\s+(.+)$/);
    const nameForExtraction = prefixMatch ? prefixMatch[2].trim() : scrapedName;
    // Use prefix as brand only if it's a known brand, not a category word like "Boitier" or "Watercooler"
    const prefixWord = prefixMatch ? prefixMatch[1].trim().toLowerCase() : '';
    const prefixAsBrand = (prefixMatch && !CATEGORY_WORDS.has(prefixWord))
      ? (extractBrand(prefixMatch[1].trim()) ?? null)
      : null;

    // Resolve category: suggestion engine result takes priority (it already ran),
    // then admin keyword rules, then inferCategory on full/stripped name
    const category = (listing.suggestion_category as ComponentCategory | null)
      ?? resolveCategory(scrapedName)
      ?? resolveCategory(nameForExtraction);
    if (!category || (category as string) === 'build') { skipped++; onProgress?.(created + skipped, pending.length); continue; }

    // Special case: Skip SO-DIMM RAM (laptop) and tray components
    if (category === 'ram') {
      const lowerScraped = scrapedName.toLowerCase();
      if (lowerScraped.includes('so-dimm') || lowerScraped.includes('sodimm') || lowerScraped.includes('tray') || lowerScraped.includes('bulk')) {
        skipped++;
        onProgress?.(created + skipped, pending.length);
        continue;
      }
    }

    const brand = prefixAsBrand ?? extractBrand(nameForExtraction);
    const cleanedName = cleanName(nameForExtraction, brand, category);

    // Reject brand-only names — if the cleaned name equals the brand (case-insensitive),
    // the product has no model identifier and is useless in the catalog.
    // e.g. scraped "XTRMLAB" → cleanedName="Xtrmlab", brand="XTRMLAB" → skip
    if (cleanedName.toLowerCase() === brand.toLowerCase() || cleanedName.length < 3) {
      skipped++;
      onProgress?.(created + skipped, pending.length);
      continue;
    }

    // NEW: Reject names with no DNA tokens (too generic to match reliably)
    const productDna = extractDna(nameForExtraction, category);
    if (productDna.length === 0) {
        skipped++;
        onProgress?.(created + skipped, pending.length);
        continue;
    }

    const dnaMatch = existingComponents.find(c => {
      if (c.category !== category) return false;
      const { score } = scoreDnaMatch(nameForExtraction, `${c.brand ?? ''} ${c.name}`, category);
      return score >= 1.0;
    });

    if (dnaMatch) {
      // Step 3b: Bundle detection (Safety Guard)
      const MAJOR_CATEGORIES = new Set(['cpu', 'gpu', 'motherboard']);
      if (MAJOR_CATEGORIES.has(category)) {
        let otherCategoryMatch = false;
        // Group components by category for bundle check if not already grouped
        const compByCat = new Map<string, CatalogComponent[]>();
        for (const c of existingComponents) {
          const list = compByCat.get(c.category) || [];
          list.push(c);
          compByCat.set(c.category, list);
        }

        for (const otherCat of MAJOR_CATEGORIES) {
          if (otherCat === category) continue;
          const otherCatComponents = compByCat.get(otherCat) || [];
          const hasMatchInOtherCat = otherCatComponents.some(oc => {
            const { score } = scoreDnaMatch(nameForExtraction, oc.brand ? `${oc.brand} ${oc.name}` : oc.name, otherCat, true);
            return score >= 1.0;
          });
          if (hasMatchInOtherCat) {
            otherCategoryMatch = true;
            break;
          }
        }
        if (otherCategoryMatch) {
          skipped++;
          onProgress?.(created + skipped, pending.length);
          continue;
        }
      }

      try {
        await sql`
          INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
          VALUES (${dnaMatch.id}, ${listing.retailer_id}, ${listing.product_url}, ${scrapedName})
          ON CONFLICT (retailer_id, product_url) DO NOTHING
        `;
        await sql`
          UPDATE unmatched_listings SET status = 'linked', linked_component_id = ${dnaMatch.id}
          WHERE id = ${listing.id}
        `;
        // Immediate price insertion — avoids "No price" until next scrape
        await sql`
          INSERT INTO prices (component_id, retailer_id, product_url, price, in_stock, last_updated)
          VALUES (${dnaMatch.id}, ${listing.retailer_id}, ${listing.product_url}, ${listing.scraped_price}, true, NOW())
          ON CONFLICT (component_id, retailer_id, product_url)
          DO UPDATE SET price = EXCLUDED.price, in_stock = true, last_updated = NOW()
        `;
        // If this is a RAM kit and the existing component has kit_count=1, upgrade it
        if (category === 'ram') {
          const kitCount = extractRamSpecs(scrapedName).kit_count;
          if (kitCount > 1) {
            await sql`
              UPDATE components SET kit_count = ${kitCount}, updated_at = NOW()
              WHERE id = ${dnaMatch.id} AND kit_count < ${kitCount}
            `;
          }
          // Also backfill cas_latency if missing
          const casLatency = extractRamSpecs(scrapedName).cas_latency;
          if (casLatency) {
            await sql`
              UPDATE components SET cas_latency = ${casLatency}, updated_at = NOW()
              WHERE id = ${dnaMatch.id} AND cas_latency IS NULL
            `;
          }
        }
        created++;
      } catch (err) { skipped++; await logger.error(`[CATALOG] DNA link error for "${cleanedName}": ${err instanceof Error ? err.message : String(err)}`); }
      onProgress?.(created + skipped, pending.length);
      continue;
    }

    // Spec Extraction & Insertion
    try {
      const slug = generateUniqueSlug(componentSlug(brand, cleanedName), existingSlugs);
      let newId: number | null = null;

      if (category === 'cpu') {
        const specs = extractCpuSpecs(nameForExtraction);
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, socket, tdp, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'cpu', ${specs?.socket ?? null}, ${specs?.tdp ?? null}, ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'gpu') {
        let specs = extractGpuSpecs(nameForExtraction);

        // Dynamic Enrichment for missing critical specs (like length_mm)
        if (specs.length_mm === null) {
          const enriched = await getDynamicEnrichment(nameForExtraction, 'gpu', dbHardwareCache, listing.product_url, scrapeProductPage);
          if (enriched) {
            specs = { ...specs, ...enriched };
          }
        }

        const specsPayload = {
          chipset: specs.chipset ?? null,
          vram_gb: specs.vram_gb ?? null,
          tdp: specs.tdp ?? null,
          length_mm: specs.length_mm ?? null,
        };
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, length_mm, tdp, chipset, vram_gb, specs, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'gpu', ${specs.length_mm}, ${specs.tdp}, ${specs.chipset}, ${specs.vram_gb}, ${JSON.stringify(specsPayload)}, ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'ram') {
        const specs = extractRamSpecs(nameForExtraction);
        const rawSpecs = extractRamSpecs(scrapedName);
        
        let ramType = specs?.ram_type || rawSpecs.ram_type || (nameForExtraction.toLowerCase().includes('ddr5') ? 'DDR5' : (nameForExtraction.toLowerCase().includes('ddr4') ? 'DDR4' : null));
        let freqMhz = specs?.frequency_mhz || rawSpecs.frequency_mhz || null;
        let kitCount = rawSpecs.kit_count ?? specs?.kit_count ?? 1;
        let casLatency = rawSpecs.cas_latency ?? specs?.cas_latency ?? null;
        const capacityGb = rawSpecs.capacity_gb ?? specs?.capacity_gb ?? null;

        // Deep-scraper fallback: hunt the product page for CAS latency, kit config, or RAM type
        if ((!casLatency || !ramType) && listing.product_url) {
          const enriched = await getDynamicEnrichment(nameForExtraction, 'ram', dbHardwareCache, listing.product_url, scrapeProductPage);
          if (enriched) {
            casLatency = casLatency ?? (enriched.cas_latency as number | null | undefined) ?? null;
            kitCount   = kitCount > 1 ? kitCount : ((enriched.kit_count as number | null | undefined) ?? kitCount);
            ramType    = ramType ?? (enriched.ram_type as string | null | undefined) ?? null;
          }
        }

        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, ram_type, frequency_mhz, kit_count, cas_latency, capacity_gb, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'ram', ${ramType}, ${freqMhz}, ${kitCount}, ${casLatency}, ${capacityGb}, ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'storage') {
        const specs = extractStorageSpecs(nameForExtraction);
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, capacity_gb, interface_type, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'storage', ${specs.capacity_gb}, ${specs.interface_type}, ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'motherboard') {
        let specs = extractMotherboardSpecs(nameForExtraction);

        // Deep-scraper fallback: hunt the product page for form_factor and socket if missing
        if ((!specs?.form_factor || !specs?.socket) && listing.product_url) {
          const enriched = await getDynamicEnrichment(nameForExtraction, 'motherboard', dbHardwareCache, listing.product_url, scrapeProductPage);
          if (enriched) {
            // Merge only missing fields — don't overwrite what the chipset extractor resolved
            if (specs) {
              specs = {
                ...specs,
                form_factor: specs.form_factor ?? (enriched.form_factor as string | undefined) ?? specs.form_factor,
                socket:      specs.socket ?? (enriched.socket as string | null | undefined) ?? specs.socket,
              };
            }
          }
        }

        // Use extracted specs or create with null fields — better to have the component than skip it
        const ramTypes = specs ? specs.supported_ram_types : null;
        const specsPayload = specs ? {
          socket: specs.socket ?? null,
          supported_ram_types: specs.supported_ram_types ?? null,
          max_ram_frequency: specs.max_ram_frequency ?? null,
          form_factor: specs.form_factor ?? null,
          ram_slots: specs.ram_slots ?? null,
        } : null;
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, socket, supported_ram_types, max_ram_frequency, ram_slots, form_factor, specs, image_url, is_active)
          VALUES (
            ${slug}, ${cleanedName}, ${brand}, 'motherboard', 
            ${specs?.socket ?? null}, 
            ${ramTypes && ramTypes.length > 0 ? `{${ramTypes.map(t => t.replace(/"/g, '')).join(',')}}` : null}::text[], 
            ${specs?.max_ram_frequency ?? null}, 
            ${specs?.ram_slots ?? null}, 
            ${specs?.form_factor ?? null}, 
            ${specsPayload ? JSON.stringify(specsPayload) : null}, 
            ${listing.image_url}, 
            true
          )
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'psu') {
        let specs = extractPsuSpecs(nameForExtraction);

        // Deep-scraper: hunt the product page for 80+ rating and modularity
        // We prioritize deep-scraped specifications over title heuristics since the detail page is the source of truth.
        if (listing.product_url) {
          const enriched = await getDynamicEnrichment(nameForExtraction, 'psu', dbHardwareCache, listing.product_url, scrapeProductPage);
          if (enriched) {
            specs = {
              ...specs,
              efficiency: (enriched.efficiency as string | null | undefined) ?? (enriched.efficiency_rating as string | null | undefined) ?? specs.efficiency ?? null,
              modularity: (enriched.modularity as string | null | undefined) ?? (enriched.modular as string | null | undefined) ?? specs.modularity ?? null,
              form_factor: (enriched.psu_form_factor as string | null | undefined) ?? (enriched.form_factor as string | null | undefined) ?? specs.form_factor ?? 'ATX',
            };
          }
        }

        // Create PSU even without extractable wattage — wattage is often in the name but format varies
        const wattage = specs?.wattage ?? null;
        const efficiency_rating = normalizeEfficiencyRating(specs?.efficiency);
        const modular = normalizeModularity(specs?.modularity);
        const psu_form_factor = normalizePsuFormFactor(specs?.form_factor);

        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, wattage, efficiency_rating, modular, psu_form_factor, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'psu', ${wattage}, ${efficiency_rating}, ${modular}, ${psu_form_factor}, ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'cooling') {
        const specs = extractCoolingSpecs(nameForExtraction);
        const tags = specs?.tags || [];
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, tdp, tags, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'cooling', ${specs?.tdp ?? null}, ${tags.length > 0 ? `{${tags.join(',')}}` : null}, ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'case') {
        // ── Negative Keyword Guard (last-mile safety net) ─────────────────────
        // resolveCategory() already runs the guard, but the suggestion_category
        // column may have been pre-populated with 'case' by a previous pipeline
        // run that didn't have this guard.  Re-check here to be safe.
        const pollutantRedirect = getCasePollutantRedirect(nameForExtraction);
        if (pollutantRedirect) {
          await logger.info(
            `[CATALOG] Negative keyword guard fired on "${cleanedName}" — ` +
            `redirected case → ${pollutantRedirect}`
          );
          // Fall through to the correct branch by updating `category` in-flight
          // and letting the existing fan/cooling blocks handle insertion below.
          // We do this via a targeted mini-insert rather than restructuring the
          // whole if-else chain:
          const fanSpecs = extractFanSpecs(nameForExtraction);
          if (pollutantRedirect === 'fan') {
            const fSlug = generateUniqueSlug(componentSlug(brand, cleanedName), existingSlugs);
            const fRows = await sql`
              INSERT INTO components (slug, name, brand, category, size_mm, rgb, pack_size, image_url, is_active)
              VALUES (${fSlug}, ${cleanedName}, ${brand}, 'fan', ${fanSpecs.size_mm}, ${fanSpecs.rgb}, ${fanSpecs.pack_size}, ${listing.image_url}, true)
              RETURNING id
            ` as { id: number }[];
            newId = fRows[0]?.id;
          } else if (pollutantRedirect === 'cooling') {
            const cSpecs = extractCoolingSpecs(nameForExtraction);
            const cTags = cSpecs?.tags || [];
            const cSlug = generateUniqueSlug(componentSlug(brand, cleanedName), existingSlugs);
            const cRows = await sql`
              INSERT INTO components (slug, name, brand, category, tdp, tags, image_url, is_active)
              VALUES (${cSlug}, ${cleanedName}, ${brand}, 'cooling', ${cSpecs?.tdp ?? null}, ${cTags.length > 0 ? `{${cTags.join(',')}}` : null}, ${listing.image_url}, true)
              RETURNING id
            ` as { id: number }[];
            newId = cRows[0]?.id;
          } else if (pollutantRedirect === 'thermal_paste') {
            const tSpecs = extractThermalPasteSpecs(nameForExtraction);
            const tSlug = generateUniqueSlug(componentSlug(brand, cleanedName), existingSlugs);
            const tRows = await sql`
              INSERT INTO components (slug, name, brand, category, weight_grams, paste_type, image_url, is_active)
              VALUES (${tSlug}, ${cleanedName}, ${brand}, 'thermal_paste', ${tSpecs.weight_grams}, ${tSpecs.paste_type}, ${listing.image_url}, true)
              RETURNING id
            ` as { id: number }[];
            newId = tRows[0]?.id;
          }
          // ↑ newId is now set; the common post-insert block below handles
          //   scraper_mappings / unmatched_listings / prices automatically.
        } else {
          // Legitimate case — proceed with normal case spec extraction
          const extractedSpecs = extractCaseSpecs(nameForExtraction);
          let max_gpu_length_mm = extractedSpecs.max_gpu_length_mm;
          let max_cpu_cooler_height_mm = extractedSpecs.max_cooler_height_mm;
          let form_factors = extractedSpecs.supported_motherboards;

          if (max_gpu_length_mm === null || form_factors === null) {
            const enriched = await getDynamicEnrichment(nameForExtraction, 'case', dbHardwareCache, listing.product_url, scrapeProductPage);
            if (enriched) {
              max_gpu_length_mm = enriched.max_gpu_length_mm ?? max_gpu_length_mm;
              max_cpu_cooler_height_mm = enriched.max_cpu_cooler_height_mm ?? max_cpu_cooler_height_mm;
              form_factors = enriched.form_factors ?? form_factors;
            }
          }

          const specsPayload = {
            max_gpu_length_mm,
            max_cpu_cooler_height_mm,
            form_factors
          };

          const rows = await sql`
            INSERT INTO components (slug, name, brand, category, max_gpu_length_mm, max_cooler_height_mm, supported_motherboards, specs, image_url, is_active)
            VALUES (${slug}, ${cleanedName}, ${brand}, 'case', ${max_gpu_length_mm}, ${max_cpu_cooler_height_mm}, ${(form_factors && form_factors.length > 0) ? `{${form_factors.map((t: string) => t.replace(/"/g, '')).join(',')}}` : null}::text[], ${JSON.stringify(specsPayload)}, ${listing.image_url}, true)
            RETURNING id
          ` as { id: number }[];
          newId = rows[0]?.id;
        }
      } else if (category === 'fan') {
        const specs = extractFanSpecs(nameForExtraction);
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, size_mm, rgb, pack_size, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'fan', ${specs.size_mm}, ${specs.rgb}, ${specs.pack_size}, ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'thermal_paste') {
        const specs = extractThermalPasteSpecs(nameForExtraction);
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, weight_grams, paste_type, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'thermal_paste', ${specs.weight_grams}, ${specs.paste_type}, ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      }

      if (!newId) { skipped++; await logger.error(`[CATALOG] Skipped: category=${category} name="${cleanedName}" brand="${brand}"`); } else {
        existingSlugs.add(slug);
        existingComponents.push({ id: newId, name: cleanedName, brand, category });
        await sql`
          INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
          VALUES (${newId}, ${listing.retailer_id}, ${listing.product_url}, ${scrapedName})
          ON CONFLICT (retailer_id, product_url) DO NOTHING
        `;
        await sql`
          UPDATE unmatched_listings SET status = 'linked', linked_component_id = ${newId}
          WHERE id = ${listing.id}
        `;
        // Immediate price insertion — avoids "No price" until next scrape
        await sql`
          INSERT INTO prices (component_id, retailer_id, product_url, price, in_stock, last_updated)
          VALUES (${newId}, ${listing.retailer_id}, ${listing.product_url}, ${listing.scraped_price}, true, NOW())
          ON CONFLICT (component_id, retailer_id, product_url)
          DO UPDATE SET price = EXCLUDED.price, in_stock = true, last_updated = NOW()
        `;
        created++;
      }
    } catch (err) { skipped++; await logger.error(`[CATALOG] Error for "${cleanedName ?? scrapedName}": ${err instanceof Error ? err.message : String(err)}`); }
    onProgress?.(created + skipped, pending.length);
  }

  if (created > 0) {
    await logger.info(`[CATALOG] ${created} new component(s) created from scraped data, ${skipped} skipped`);
  }
  return { created, skipped };
}
