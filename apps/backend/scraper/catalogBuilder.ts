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
import { scoreDnaMatch, type CatalogComponent } from '../src/utils/componentMatcher.js';
import { logger } from './utils/logger.js';
import { getSql, setSql, resetSql } from '../src/db/index.js';
import {
  decodeHtml, inferCategory, extractBrand, cleanName,
  extractCpuSpecs, extractGpuSpecs, extractRamSpecs, extractStorageSpecs,
  extractMotherboardSpecs, extractPsuSpecs, extractCoolingSpecs, extractCaseSpecs,
  extractFanSpecs, extractThermalPasteSpecs
} from '@shared/component-utils';
import { ComponentCategory } from '@shared/types';
import { loadAdminRules, matchesRule, type KeywordRule } from '../src/services/keywordRulesService.js';

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
        return rule.category as ComponentCategory;
      }
    }
    return inferCategory(name);
  }

  const pending = (await sql`
    SELECT ul.id, ul.retailer_id, ul.product_url, ul.scraped_name,
           us.category AS suggestion_category
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    WHERE ul.status = 'pending'
      AND ul.scraped_name IS NOT NULL
      AND ul.scraped_name != ''
    ORDER BY ul.scraped_at DESC
  `) as { id: number; retailer_id: number; product_url: string; scraped_name: string; suggestion_category: string | null }[];

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
    const CATEGORY_WORDS = new Set(['boitier', 'boîtier', 'watercooler', 'watercooling', 'processeur', 'carte graphique', 'alimentation', 'stockage', 'memoire', 'mémoire']);
    const prefixWord = prefixMatch ? prefixMatch[1].trim().toLowerCase() : '';
    const prefixAsBrand = (prefixMatch && !CATEGORY_WORDS.has(prefixWord))
      ? (extractBrand(prefixMatch[1].trim()) ?? null)
      : null;

    // Resolve category: suggestion engine result takes priority (it already ran),
    // then admin keyword rules, then inferCategory on full/stripped name
    const category = (listing.suggestion_category as ComponentCategory | null)
      ?? resolveCategory(scrapedName)
      ?? resolveCategory(nameForExtraction);
    if (!category) { skipped++; onProgress?.(created + skipped, pending.length); continue; }

    const brand = prefixAsBrand ?? extractBrand(nameForExtraction);
    const cleanedName = cleanName(nameForExtraction, brand);
    const dnaMatch = existingComponents.find(c => {
      if (c.category !== category) return false;
      const { score } = scoreDnaMatch(nameForExtraction, `${c.brand ?? ''} ${c.name}`, category);
      return score >= 1.0;
    });

    if (dnaMatch) {
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
        if (specs) {
          const rows = await sql`
            INSERT INTO components (slug, name, brand, category, socket, tdp, is_active)
            VALUES (${slug}, ${cleanedName}, ${brand}, 'cpu', ${specs.socket}, ${specs.tdp}, true)
            RETURNING id
          ` as { id: number }[];
          newId = rows[0]?.id;
        }
      } else if (category === 'gpu') {
        const specs = extractGpuSpecs(nameForExtraction);
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, length_mm, tdp, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'gpu', ${specs.length_mm}, ${specs.tdp}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'ram') {
        const specs = extractRamSpecs(nameForExtraction);
        if (specs) {
          const rows = await sql`
            INSERT INTO components (slug, name, brand, category, ram_type, frequency_mhz, is_active)
            VALUES (${slug}, ${cleanedName}, ${brand}, 'ram', ${specs.ram_type}, ${specs.frequency_mhz}, true)
            RETURNING id
          ` as { id: number }[];
          newId = rows[0]?.id;
        }
      } else if (category === 'storage') {
        const specs = extractStorageSpecs(nameForExtraction);
        if (specs) {
          const rows = await sql`
            INSERT INTO components (slug, name, brand, category, is_active)
            VALUES (${slug}, ${cleanedName}, ${brand}, 'storage', true)
            RETURNING id
          ` as { id: number }[];
          newId = rows[0]?.id;
        }
      } else if (category === 'motherboard') {
        const specs = extractMotherboardSpecs(nameForExtraction);
        if (specs) {
          const rows = await sql`
            INSERT INTO components (slug, name, brand, category, socket, supported_ram_types, max_ram_frequency, is_active)
            VALUES (${slug}, ${cleanedName}, ${brand}, 'motherboard', ${specs.socket}, ${specs.supported_ram_types}, ${specs.max_ram_frequency}, true)
            RETURNING id
          ` as { id: number }[];
          newId = rows[0]?.id;
        }
      } else if (category === 'psu') {
        const specs = extractPsuSpecs(nameForExtraction);
        if (specs) {
          const rows = await sql`
            INSERT INTO components (slug, name, brand, category, wattage, is_active)
            VALUES (${slug}, ${cleanedName}, ${brand}, 'psu', ${specs.wattage}, true)
            RETURNING id
          ` as { id: number }[];
          newId = rows[0]?.id;
        }
      } else if (category === 'cooling') {
        const specs = extractCoolingSpecs(nameForExtraction);
        // Create cooling component even if specs can't be extracted — tdp is optional
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, tdp, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'cooling', ${specs?.tdp ?? null}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'case') {
        const specs = extractCaseSpecs(nameForExtraction);
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, max_gpu_length_mm, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'case', ${specs.max_gpu_length_mm}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'fan') {
        const specs = extractFanSpecs(nameForExtraction);
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, size_mm, rgb, pack_size, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'fan', ${specs.size_mm}, ${specs.rgb}, ${specs.pack_size}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'thermal_paste') {
        const specs = extractThermalPasteSpecs(nameForExtraction);
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, weight_grams, paste_type, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'thermal_paste', ${specs.weight_grams}, ${specs.paste_type}, true)
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
