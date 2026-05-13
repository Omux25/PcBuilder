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
import { scoreDnaMatch, type CatalogComponent } from '../../../../core/utils/componentMatcher.js';
import { logger } from './utils/logger.js';
import { getSql, setSql, resetSql } from '../../../../core/db/index.js';
import {
  decodeHtml, inferCategory, extractBrand, cleanName, CATEGORY_WORDS,
  extractCpuSpecs, extractGpuSpecs, extractRamSpecs,
  extractMotherboardSpecs, extractPsuSpecs, extractCoolingSpecs, extractCaseSpecs,
  extractFanSpecs, extractThermalPasteSpecs
} from '@shared/component-utils';
import { ComponentCategory } from '@shared/types';
import { loadAdminRules, matchesRule, type KeywordRule } from '../rules/services/keywordRulesLegacy.js';

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
    if (!category || category === 'build' as any) { skipped++; onProgress?.(created + skipped, pending.length); continue; }

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
        const specs = extractGpuSpecs(nameForExtraction);
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, length_mm, tdp, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'gpu', ${specs.length_mm}, ${specs.tdp}, ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'ram') {
        const specs = extractRamSpecs(nameForExtraction);
        const ramType = specs?.ram_type ?? (nameForExtraction.toLowerCase().includes('ddr5') ? 'DDR5' : 'DDR4');
        const freqMhz = specs?.frequency_mhz ?? (ramType === 'DDR5' ? 4800 : 3200);
        // Extract kit_count and cas_latency from raw scraped name — cleanName() strips (2x8GB) and CL notation
        const rawSpecs = extractRamSpecs(scrapedName);
        const kitCount = rawSpecs.kit_count ?? specs?.kit_count ?? 1;
        const casLatency = rawSpecs.cas_latency ?? specs?.cas_latency ?? null;
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, ram_type, frequency_mhz, kit_count, cas_latency, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'ram', ${ramType}, ${freqMhz}, ${kitCount}, ${casLatency}, ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'storage') {
        // Create storage even without extractable specs — name alone is sufficient
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'storage', ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'motherboard') {
        const specs = extractMotherboardSpecs(nameForExtraction);
        // Use extracted specs or create with null fields — better to have the component than skip it
        const ramTypes = specs ? specs.supported_ram_types : null;
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, socket, supported_ram_types, max_ram_frequency, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'motherboard', ${specs?.socket ?? null}, ${ramTypes}, ${specs?.max_ram_frequency ?? null}, ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'psu') {
        const specs = extractPsuSpecs(nameForExtraction);
        // Create PSU even without extractable wattage — wattage is often in the name but format varies
        const wattage = specs?.wattage ?? null;
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, wattage, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'psu', ${wattage}, ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'cooling') {
        const specs = extractCoolingSpecs(nameForExtraction);
        // Create cooling component even if specs can't be extracted — tdp is optional
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, tdp, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'cooling', ${specs?.tdp ?? null}, ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
      } else if (category === 'case') {
        const specs = extractCaseSpecs(nameForExtraction);
        const rows = await sql`
          INSERT INTO components (slug, name, brand, category, max_gpu_length_mm, image_url, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'case', ${specs.max_gpu_length_mm}, ${listing.image_url}, true)
          RETURNING id
        ` as { id: number }[];
        newId = rows[0]?.id;
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
