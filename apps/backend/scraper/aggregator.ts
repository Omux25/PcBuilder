/**
 * Aggregator — processes scraped prices using the canonical catalog model.
 *
 * For each scraped product:
 * 1. Look up scraper_mappings by (retailer_id, product_url)
 * 2. If mapping found → group by (component_id, retailer_id), pick best variant
 *    (cheapest in-stock, or cheapest out-of-stock if all variants are out)
 * 3. UPSERT the best variant into prices + record price history if changed
 * 4. If no mapping → INSERT into unmatched_listings
 *
 * For UltraPC (retailer_id=10): checks actual stock via PrestaShop AJAX
 * for mapped products only (not all 2164 scraped products).
 *
 * Requirements: 2.1, 2.2, 3.2, 4.2, 6.5
 */

import { sql as bunSql } from 'bun';
import type { ScrapedPrice } from './scrapers/baseScraper.js';
import { extractVariant } from '../src/utils/variantExtractor.js';
import { getSql, setSql, resetSql } from '../src/db/index.js';
import { logger } from './utils/logger.js';
import { SCRAPER_CONFIG } from '@shared/scraper-config';
import {
  decodeHtml, inferCategory, extractBrand, cleanName,
  extractCpuSpecs, extractGpuSpecs, extractRamSpecs, extractStorageSpecs,
  extractMotherboardSpecs, extractPsuSpecs, extractCoolingSpecs, extractCaseSpecs,
  extractFanSpecs, extractThermalPasteSpecs
} from '@shared/component-utils';
import { componentSlug, generateUniqueSlug } from '@shared/slugify';
import { scoreDnaMatch, extractDna, type CatalogComponent } from '../src/utils/componentMatcher.js';
import { loadAdminRules, matchesRule, type KeywordRule } from '../src/services/keywordRulesService.js';
import { ComponentCategory } from '@shared/types';
import { scoreImageQuality } from '@shared/image-utils';

// Re-export DI helpers so tests can inject a mock SQL function.
export { setSql, resetSql };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AggregateResult {
  updated: number;
  unmatched: number;
  errors: number;
}

// ── Aggregator ────────────────────────────────────────────────────────────────

export async function aggregate(
  prices: ScrapedPrice[],
  retailerNameToId?: Map<string, number>,
  options: { skipStockSync?: boolean } = {},
  onProgress?: (done: number, total: number) => void | Promise<void>
): Promise<AggregateResult & { autoMapped: number; autoCreated: number }> {
  const { skipStockSync = false } = options;
  let updated = 0;
  let unmatched = 0;
  let errors = 0;
  let autoCreated = 0;
  let autoMapped = 0;

  if (prices.length === 0) return { updated, unmatched, errors, autoMapped, autoCreated };

  const sql = getSql();

  // Normalize a URL to just its origin (scheme + hostname).
  function normalizeUrl(url: string): string {
    try {
      const { origin } = new URL(url.startsWith('http') ? url : `https://${url}`);
      return origin;
    } catch {
      return url.replace(/\/+$/, '');
    }
  }

  const isRealSql = (sql as unknown) === (bunSql as unknown);

  // UltraPC stock is now parsed directly from HTML listing cards (no extra HTTP calls).
  // checkStock() removed — "Produit en stock" text extracted per card in the scraper.

  // ── PRE-FETCH CONTEXT ──────────────────────────────────────────────────────

  // 1. Existing mappings for these retailers
  const retailerIds = [...new Set(prices.map(p => p.retailer_id))];
  const mappingMap = new Map<string, { component_id: number; category: string }>();
  if (isRealSql) {
    try {
      const allMappings = (await bunSql`
        SELECT sm.retailer_id, sm.product_url, sm.component_id, c.category
        FROM scraper_mappings sm
        JOIN components c ON c.id = sm.component_id
        WHERE sm.retailer_id IN ${bunSql(retailerIds)}
      `) as { retailer_id: number; product_url: string; component_id: number; category: string }[];
      for (const m of allMappings) mappingMap.set(`${m.retailer_id}|${m.product_url}`, m);
    } catch { /* non-critical */ }
  } else {
    // Test mode: use injected sql with a query the mock can intercept
    try {
      const allMappings = (await sql`
        SELECT sm.retailer_id, sm.product_url, sm.component_id, c.category
        FROM scraper_mappings sm
        JOIN components c ON c.id = sm.component_id
      `) as { retailer_id: number; product_url: string; component_id: number; category: string }[];
      for (const m of allMappings) mappingMap.set(`${m.retailer_id}|${m.product_url}`, m);
    } catch { /* non-critical */ }
  }

  // 2. All active components (pre-grouped by category with cached DNA for O(1) matching speed)
  const existingComponents = isRealSql ? (await sql`
    SELECT id, name, brand, category FROM components WHERE is_active = true
  `) as CatalogComponent[] : [];

  const componentsByCategory = new Map<string, (CatalogComponent & { dna: string[]; slug: string })[]>();
  for (const c of existingComponents) {
    const list = componentsByCategory.get(c.category) || [];
    const fullName = c.brand ? `${c.brand} ${c.name}` : c.name;
    list.push({ ...c, dna: extractDna(fullName, c.category), slug: componentSlug(c.brand, c.name) });
    componentsByCategory.set(c.category, list);
  }

  // 3. All slugs (for auto-creation - use a Set for O(1) lookup)
  const existingSlugsRows = isRealSql ? (await sql`SELECT slug FROM components WHERE slug IS NOT NULL`) as { slug: string }[] : [];
  const existingSlugs = new Set(existingSlugsRows.map(r => r.slug));
  const slugToComponent = new Map<string, CatalogComponent>();
  for (const c of existingComponents) slugToComponent.set(componentSlug(c.brand, c.name), c);

  // 4. Admin keyword rules (for categorization)
  let adminRules: KeywordRule[] = [];
  try { adminRules = await loadAdminRules(); } catch { /* ignore */ }

  // 5. Current prices (for history tracking - O(1) lookup)
  const priceMap = new Map<string, number>();
  if (isRealSql && existingComponents.length > 0) {
    try {
      const currentPrices = (await bunSql`
        SELECT component_id, retailer_id, product_url, price
        FROM prices
        WHERE retailer_id IN ${bunSql(retailerIds)}
      `) as { component_id: number; retailer_id: number; product_url: string; price: number }[];
      for (const cp of currentPrices) priceMap.set(`${cp.component_id}|${cp.retailer_id}|${cp.product_url}`, Number(cp.price));
    } catch { /* non-critical */ }
  }

  // ── HELPERS ────────────────────────────────────────────────────────────────

  function resolveCategory(name: string): ComponentCategory | null {
    for (const rule of adminRules) {
      if (matchesRule(rule, name)) return rule.category as ComponentCategory;
    }
    return inferCategory(name);
  }

  // ── PROCESSING ─────────────────────────────────────────────────────────────
  //
  // Two-phase approach to eliminate per-item DB round-trips:
  //
  // Phase A (pure memory): Classify every scraped item as one of:
  //   - resolved:  already has a mapping → goes straight to finalResolved
  //   - dnaMatch:  matches an existing component by DNA → goes to finalResolved
  //   - toCreate:  needs a new component row → collected for bulk insert
  //   - unmatched: no category or no match → goes to unmatchedListingsToUpsert
  //   - dismissed: junk (SO-DIMM, tray, etc.) → goes to dismissedListingsToUpdate
  //
  // Phase B (bulk DB): Insert all toCreate components in one batch per category,
  //   get back IDs, then push everything into finalResolved.

  const finalResolved: (ScrapedPrice & { component_id: number; category: string })[] = [];
  const unmatchedListingsToUpsert: { retailer_id: number; product_url: string; scraped_name: string; scraped_price: number }[] = [];
  const dismissedListingsToUpdate: { retailer_id: number; product_url: string }[] = [];

  // Items that need a new component row — keyed by slug to deduplicate
  type PendingCreate = {
    slug: string;
    cleanedName: string;
    brand: string | null;
    category: string;
    nameForExtraction: string;
    prices: ScrapedPrice[]; // all scraped items that map to this new component
  };
  const toCreateBySlug = new Map<string, PendingCreate>();

  const CATEGORY_WORDS = new Set(['boitier', 'boîtier', 'watercooler', 'watercooling', 'processeur', 'carte graphique', 'alimentation', 'stockage', 'memoire', 'mémoire', 'aircooler', 'air cooler', 'carte mère', 'carte mere', 'disque']);

  // Categories the DB components table accepts (matches components_category_check constraint).
  // Peripherals and accessories inferred by inferCategory() are intentionally excluded —
  // they go to unmatched_listings instead of being auto-created as components.
  const DB_CATEGORIES = new Set([
    'cpu', 'motherboard', 'gpu', 'ram', 'storage',
    'psu', 'case', 'cooling', 'fan', 'thermal_paste',
  ]);

  // ── Phase A: classify all items in memory ──────────────────────────────────
  let classifiedCount = 0;
  for (const p of prices) {
    try {
      const scrapedName = decodeHtml(p.product_name ?? '');

      // Step 1: Existing Mapping?
      const mapping = mappingMap.get(`${p.retailer_id}|${p.product_url}`);
      if (mapping) {
        finalResolved.push({ ...p, component_id: mapping.component_id, category: mapping.category });
        continue;
      }

      // Step 2: Resolve category
      const prefixMatch = scrapedName.match(/^([^–\-]+)[–\-]\s+(.+)$/);
      const nameForExtraction = prefixMatch ? prefixMatch[2].trim() : scrapedName;
      const category = p.manual_category || resolveCategory(scrapedName) || resolveCategory(nameForExtraction) || (p as any).sug_category;

      // Dismiss known junk
      if (!category && (
        scrapedName.toLowerCase().includes('so-dimm') ||
        scrapedName.toLowerCase().includes('sodimm') ||
        scrapedName.toLowerCase().includes('tray') ||
        scrapedName.toLowerCase().includes('bulk') ||
        scrapedName.toLowerCase().includes('sans emballage')
      )) {
        dismissedListingsToUpdate.push({ retailer_id: p.retailer_id, product_url: p.product_url });
        continue;
      }

      if (!category) {
        unmatchedListingsToUpsert.push({
          retailer_id: p.retailer_id,
          product_url: p.product_url,
          scraped_name: scrapedName,
          scraped_price: p.price,
          image_url: p.image_url ?? null
        });
        unmatched++;
        continue;
      }

      const prefixWord = prefixMatch ? prefixMatch[1].trim().toLowerCase() : '';
      const prefixAsBrand = (prefixMatch && !CATEGORY_WORDS.has(prefixWord)) ? (extractBrand(prefixMatch[1].trim()) ?? null) : null;
      const brand = prefixAsBrand ?? extractBrand(nameForExtraction);

      // Step 3: DNA Match against existing components
      const catComponents = componentsByCategory.get(category) || [];
      const dnaMatch = catComponents.find(c => {
        const { score } = scoreDnaMatch(nameForExtraction, c.brand ? `${c.brand} ${c.name}` : c.name, category);
        const threshold = SCRAPER_CONFIG.PARTIAL_MATCH_CATEGORIES.includes(category) ? SCRAPER_CONFIG.PARTIAL_THRESHOLD : SCRAPER_CONFIG.PERFECT_THRESHOLD;
        return score >= threshold;
      });

      if (dnaMatch) {
        finalResolved.push({ ...p, component_id: dnaMatch.id, category });
        autoMapped++;
        continue;
      }

      // Step 4: Slug match (catches duplicates within this batch)
      const cleanedName = cleanName(nameForExtraction, brand);
      const baseSlug = componentSlug(brand, cleanedName);
      const existingBySlug = slugToComponent.get(baseSlug);
      if (existingBySlug) {
        finalResolved.push({ ...p, component_id: existingBySlug.id, category });
        autoMapped++;
        continue;
      }

      // Step 5: Queue for creation — only for DB-supported categories.
      // Peripherals/accessories (mouse, keyboard, monitor, etc.) are not in the
      // components_category_check constraint — send them to unmatched instead.
      if (!DB_CATEGORIES.has(category)) {
        unmatchedListingsToUpsert.push({
          retailer_id: p.retailer_id,
          product_url: p.product_url,
          scraped_name: scrapedName,
          scraped_price: p.price,
          image_url: p.image_url ?? null
        });
        unmatched++;
        continue;
      }

      const existing = toCreateBySlug.get(baseSlug);
      if (existing) {
        existing.prices.push(p);
      } else {
        const slug = generateUniqueSlug(baseSlug, existingSlugs);
        existingSlugs.add(slug); // reserve immediately to prevent duplicates within this batch
        toCreateBySlug.set(baseSlug, { slug, cleanedName, brand, category, nameForExtraction, prices: [p] });
      }
    } catch (err) {
      errors++;
      await logger.error(`[PIPELINE] Classification failed for ${p.product_url}: ${err instanceof Error ? err.message : String(err)}`);
    }
    classifiedCount++;
    await onProgress?.(classifiedCount, prices.length);
  }

  // ── Phase B: bulk-insert all new components ────────────────────────────────
  if (toCreateBySlug.size > 0) {
    await logger.info(`[PIPELINE] Phase A done — ${finalResolved.length} resolved, ${toCreateBySlug.size} to create, ${unmatched} unmatched. Starting bulk insert...`);
    const pending = [...toCreateBySlug.values()];

    // Build typed rows per category and insert in batches
    type ComponentRow = Record<string, unknown>;
    const rowsToInsert: (ComponentRow & { _pending: PendingCreate })[] = [];

    for (const item of pending) {
      const { slug, cleanedName: name, brand, category, nameForExtraction } = item;

      // Pick the best image from this item's scraped prices
      let bestImage: string | null = null;
      let bestScore = -Infinity;
      for (const p of item.prices) {
        if (!p.image_url) continue;
        const urlLower = p.image_url.toLowerCase();
        let score = 50;
        if (urlLower.includes('mpk') || urlLower.includes('bundle')) score -= 30;
        if (urlLower.includes('placeholder') || urlLower.includes('no-image')) score = -100;
        if (score > bestScore) { bestScore = score; bestImage = p.image_url; }
      }

      let row: ComponentRow = { slug, name, brand, category, is_active: true, image_url: bestScore >= 0 ? bestImage : null };

      if (category === 'cpu') {
        const s = extractCpuSpecs(nameForExtraction);
        row = { ...row, socket: s?.socket ?? null, tdp: s?.tdp ?? null };
      } else if (category === 'gpu') {
        const s = extractGpuSpecs(nameForExtraction);
        row = { ...row, length_mm: s?.length_mm ?? null, tdp: s?.tdp ?? null };
      } else if (category === 'ram') {
        const s = extractRamSpecs(nameForExtraction);
        const ramType = s?.ram_type ?? (nameForExtraction.toLowerCase().includes('ddr5') ? 'DDR5' : 'DDR4');
        row = { ...row, ram_type: ramType, frequency_mhz: s?.frequency_mhz ?? (ramType === 'DDR5' ? 4800 : 3200) };
      } else if (category === 'motherboard') {
        const s = extractMotherboardSpecs(nameForExtraction);
        row = { ...row, socket: s?.socket ?? null, supported_ram_types: s ? `{${s.supported_ram_types.join(',')}}` : null, max_ram_frequency: s?.max_ram_frequency ?? null };
      } else if (category === 'psu') {
        const s = extractPsuSpecs(nameForExtraction);
        row = { ...row, wattage: s?.wattage ?? null };
      } else if (category === 'cooling') {
        const s = extractCoolingSpecs(nameForExtraction);
        row = { ...row, tdp: s?.tdp ?? null };
      } else if (category === 'case') {
        const s = extractCaseSpecs(nameForExtraction);
        row = { ...row, max_gpu_length_mm: s?.max_gpu_length_mm ?? null };
      } else if (category === 'fan') {
        const s = extractFanSpecs(nameForExtraction);
        row = { ...row, size_mm: s?.size_mm ?? null, rgb: s?.rgb ?? null, pack_size: s?.pack_size ?? null };
      } else if (category === 'thermal_paste') {
        const s = extractThermalPasteSpecs(nameForExtraction);
        row = { ...row, weight_grams: s?.weight_grams ?? null, paste_type: s?.paste_type ?? null };
      }
      // storage + misc categories: just slug/name/brand/category/is_active

      rowsToInsert.push({ ...row, _pending: item });
    }

    // Insert in batches of 200 — each row may have different columns so insert per-category
    const byCategory = new Map<string, typeof rowsToInsert>();
    for (const row of rowsToInsert) {
      const cat = row.category as string;
      const list = byCategory.get(cat) || [];
      list.push(row);
      byCategory.set(cat, list);
    }

    for (const [, catRows] of byCategory) {
      const BATCH = 200;
      for (let i = 0; i < catRows.length; i += BATCH) {
        const batch = catRows.slice(i, i + BATCH);
        try {
          // Strip the _pending helper before sending to DB
          const dbRows = batch.map(({ _pending, ...rest }) => rest);
          const inserted = await sql`
            INSERT INTO components ${sql(dbRows)}
            ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
            RETURNING id, slug
          ` as { id: number; slug: string }[];

          for (const row of inserted) {
            const item = batch.find(b => b.slug === row.slug)?._pending;
            if (!item) continue;
            const newComp = { id: row.id, name: item.cleanedName, brand: item.brand, category: item.category, dna: extractDna(item.cleanedName, item.category), slug: row.slug };
            existingComponents.push(newComp);
            slugToComponent.set(row.slug, newComp);
            const list = componentsByCategory.get(item.category) || [];
            list.push(newComp);
            componentsByCategory.set(item.category, list);

            for (const p of item.prices) {
              finalResolved.push({ ...p, component_id: row.id, category: item.category });
            }
            autoCreated++;
          }
        } catch (err) {
          // Fall back to individual inserts for this batch on error
          for (const row of batch) {
            try {
              const { _pending: item, ...dbRow } = row;
              const inserted2 = await sql`INSERT INTO components ${sql([dbRow])} ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id, slug` as { id: number; slug: string }[];
              if (inserted2[0]) {
                const newComp = { id: inserted2[0].id, name: item.cleanedName, brand: item.brand, category: item.category, dna: extractDna(item.cleanedName, item.category), slug: inserted2[0].slug };
                existingComponents.push(newComp);
                slugToComponent.set(inserted2[0].slug, newComp);
                for (const p of item.prices) finalResolved.push({ ...p, component_id: inserted2[0].id, category: item.category });
                autoCreated++;
              }
            } catch (err2) {
              await logger.error(`[PIPELINE] Creation failed for "${row.name}": ${err2 instanceof Error ? err2.message : String(err2)}`);
              for (const p of row._pending.prices) {
                unmatchedListingsToUpsert.push({
                  retailer_id: p.retailer_id,
                  product_url: p.product_url,
                  scraped_name: decodeHtml(p.product_name ?? ''),
                  scraped_price: p.price,
                  image_url: p.image_url ?? null
                });
                unmatched++;
              }
            }
          }
        }
      }
    }
  }

  // ── PERSISTENCE ────────────────────────────────────────────────────────────

  // imageUpdates collected during Phase 5 — used by Phase 5.5 (image backfill)
  const imageUpdates = new Map<number, { url: string; score: number }>(); // component_id → best image

  // Phase 4 + 5: Bulk Persist Mappings, Unmatched, Prices & History
  // Wrapped in a single transaction so mappings + prices either both commit or
  // both roll back — prevents ghost data (mapping exists but price missing, etc.)
  if (isRealSql) {
    await bunSql.begin(async (tx) => {
      // Phase 4: Mappings & Unmatched
      if (finalResolved.length > 0) {
        // Deduplicate by (retailer_id, product_url) — keep last occurrence.
        // PostgreSQL's ON CONFLICT DO UPDATE cannot update the same row twice
        // in a single statement, which happens when a retailer lists the same
        // URL under multiple categories (e.g. a product in two sections).
        const mappingMap2 = new Map<string, { component_id: number; retailer_id: number; product_url: string; product_identifier: string }>();
        for (const p of finalResolved) {
          mappingMap2.set(`${p.retailer_id}|${p.product_url}`, {
            component_id: p.component_id,
            retailer_id: p.retailer_id,
            product_url: p.product_url,
            product_identifier: decodeHtml(p.product_name ?? '')
          });
        }
        const mappingRows = [...mappingMap2.values()];
        for (let i = 0; i < mappingRows.length; i += 500) {
          const batch = mappingRows.slice(i, i + 500);
          await tx`
            INSERT INTO scraper_mappings ${tx(batch)}
            ON CONFLICT (retailer_id, product_url) DO UPDATE SET
              component_id = EXCLUDED.component_id,
              product_identifier = EXCLUDED.product_identifier
          `;
        }
      }

      if (unmatchedListingsToUpsert.length > 0) {
        // Deduplicate unmatched by (retailer_id, product_url) as well
        const unmatchedMap = new Map<string, typeof unmatchedListingsToUpsert[0]>();
        for (const u of unmatchedListingsToUpsert) {
          unmatchedMap.set(`${u.retailer_id}|${u.product_url}`, u);
        }
        const dedupedUnmatched = [...unmatchedMap.values()];
        for (let i = 0; i < dedupedUnmatched.length; i += 500) {
          const batch = dedupedUnmatched.slice(i, i + 500);
          await tx`
            INSERT INTO unmatched_listings ${tx(batch)}
            ON CONFLICT (retailer_id, product_url) DO UPDATE SET
              scraped_name = EXCLUDED.scraped_name,
              scraped_price = EXCLUDED.scraped_price,
              image_url = EXCLUDED.image_url,
              scraped_at = NOW(),
              status = 'pending'
          `;
        }
      }

      if (dismissedListingsToUpdate.length > 0) {
        for (let i = 0; i < dismissedListingsToUpdate.length; i += 500) {
          const batch = dismissedListingsToUpdate.slice(i, i + 500);
          // Bun.sql doesn't support multi-column WHERE IN — use individual updates
          await Promise.all(batch.map(b => tx`
            UPDATE unmatched_listings
            SET status = 'dismissed'
            WHERE retailer_id = ${b.retailer_id} AND product_url = ${b.product_url}
          `));
        }
      }

      // Phase 5: Prices & History
      if (finalResolved.length > 0) {
        // Deduplicate by (component_id, retailer_id, product_url) — keep last
        const priceRowMap = new Map<string, { component_id: number; retailer_id: number; price: number; in_stock: boolean; product_url: string; variant_label: string | null; variant_details: Record<string, unknown> | null }>();
        const historyRows: { component_id: number; retailer_id: number; price: number; in_stock: boolean }[] = [];

        for (const p of finalResolved) {
          const { label: variantLabel, details: variantDetails } = extractVariant(decodeHtml(p.product_name ?? ''), p.category, p.product_description);
          const key = `${p.component_id}|${p.retailer_id}|${p.product_url}`;
          priceRowMap.set(key, {
            component_id: p.component_id,
            retailer_id: p.retailer_id,
            price: p.price,
            in_stock: p.in_stock,
            product_url: p.product_url,
            variant_label: variantLabel || null,
            variant_details: Object.keys(variantDetails).length > 0 ? variantDetails as Record<string, unknown> : null,
          });
          const lastPrice = priceMap.get(key) ?? null;
          if (lastPrice === null || Math.abs(lastPrice - p.price) > 0.01) {
            historyRows.push({ component_id: p.component_id, retailer_id: p.retailer_id, price: p.price, in_stock: p.in_stock });
          }
          // Collect image URLs for components - choose best quality image
          if ((p as any).image_url) {
            const imageUrl = (p as any).image_url;
            const productName = p.product_name ?? '';
            const score = scoreImageQuality(imageUrl, productName);
            const existing = imageUpdates.get(p.component_id);
            if (!existing || score > existing.score) {
              imageUpdates.set(p.component_id, { url: imageUrl, score });
            }
          }
        }

        const priceRows = [...priceRowMap.values()];
        const BATCH = 500;
        for (let i = 0; i < priceRows.length; i += BATCH) {
          const batch = priceRows.slice(i, i + BATCH);
          try {
            await tx`
              INSERT INTO prices ${tx(batch.map(r => ({ ...r, last_updated: new Date() })))}
              ON CONFLICT (component_id, retailer_id, product_url)
              DO UPDATE SET
                price = EXCLUDED.price,
                in_stock = EXCLUDED.in_stock,
                variant_label = EXCLUDED.variant_label,
                variant_details = EXCLUDED.variant_details,
                last_updated = EXCLUDED.last_updated
            `;
            updated += batch.length;
          } catch (err) {
            errors += batch.length;
            await logger.error(`[PIPELINE] Bulk price upsert failed: ${err instanceof Error ? err.message : String(err)}`);
            throw err; // re-throw to roll back transaction
          }
        }

        // Bulk insert price history
        if (historyRows.length > 0) {
          for (let i = 0; i < historyRows.length; i += BATCH) {
            const batch = historyRows.slice(i, i + BATCH);
            try {
              await tx`INSERT INTO price_history ${tx(batch)}`;
            } catch { /* non-critical — history failure must not roll back prices */ }
          }
        }
      }
    });
  } else {
    // ── TEST MODE (injected mock sql — no transactions) ──────────────────────
    if (finalResolved.length > 0) {
      const mappingMap2 = new Map<string, { component_id: number; retailer_id: number; product_url: string; product_identifier: string }>();
      for (const p of finalResolved) {
        mappingMap2.set(`${p.retailer_id}|${p.product_url}`, {
          component_id: p.component_id,
          retailer_id: p.retailer_id,
          product_url: p.product_url,
          product_identifier: decodeHtml(p.product_name ?? '')
        });
      }
      const mappingRows = [...mappingMap2.values()];
      for (let i = 0; i < mappingRows.length; i += 500) {
        const batch = mappingRows.slice(i, i + 500);
        try {
          for (const m of batch) {
            await sql`
              INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
              VALUES (${m.component_id}, ${m.retailer_id}, ${m.product_url}, ${m.product_identifier})
              ON CONFLICT (retailer_id, product_url) DO UPDATE SET
                component_id = EXCLUDED.component_id,
                product_identifier = EXCLUDED.product_identifier
            `;
          }
        } catch { /* non-critical in test mode */ }
      }
    }

    if (unmatchedListingsToUpsert.length > 0) {
      const unmatchedMap = new Map<string, typeof unmatchedListingsToUpsert[0]>();
      for (const u of unmatchedListingsToUpsert) {
        unmatchedMap.set(`${u.retailer_id}|${u.product_url}`, u);
      }
      const dedupedUnmatched = [...unmatchedMap.values()];
      for (let i = 0; i < dedupedUnmatched.length; i += 500) {
        const batch = dedupedUnmatched.slice(i, i + 500);
        try {
          for (const u of batch) {
            await sql`
              INSERT INTO unmatched_listings (retailer_id, product_url, scraped_name, scraped_price, image_url, scraped_at, status)
              VALUES (${u.retailer_id}, ${u.product_url}, ${u.scraped_name}, ${u.scraped_price}, ${u.image_url ?? null}, NOW(), 'pending')
              ON CONFLICT (retailer_id, product_url) DO UPDATE SET
                scraped_name = EXCLUDED.scraped_name,
                scraped_price = EXCLUDED.scraped_price,
                image_url = EXCLUDED.image_url,
                scraped_at = NOW(),
                status = 'pending'
            `;
          }
        } catch { /* non-critical in test mode */ }
      }
    }

    if (dismissedListingsToUpdate.length > 0) {
      for (let i = 0; i < dismissedListingsToUpdate.length; i += 500) {
        const batch = dismissedListingsToUpdate.slice(i, i + 500);
        try {
          await Promise.all(batch.map(b => sql`
            UPDATE unmatched_listings
            SET status = 'dismissed'
            WHERE retailer_id = ${b.retailer_id} AND product_url = ${b.product_url}
          `));
        } catch { /* non-critical in test mode */ }
      }
    }

    // Test mode prices
    for (const p of finalResolved) {
      const { label: variantLabel, details: variantDetails } = extractVariant(decodeHtml(p.product_name ?? ''), p.category, p.product_description);
      try {
        await sql`
          INSERT INTO prices (component_id, retailer_id, price, in_stock, product_url, variant_label, variant_details, last_updated)
          VALUES (${p.component_id}, ${p.retailer_id}, ${p.price}, ${p.in_stock}, ${p.product_url}, ${variantLabel || null}, ${Object.keys(variantDetails).length > 0 ? variantDetails as Record<string, unknown> : null}, NOW())
          ON CONFLICT (component_id, retailer_id, product_url)
          DO UPDATE SET price = EXCLUDED.price, in_stock = EXCLUDED.in_stock, last_updated = NOW()
        `;
        updated++;
      } catch (err) {
        errors++;
      }
    }
  }

  // Phase 5.5: Backfill Component Images
  // Update components with better quality images from scraped data
  // This runs on every scrape to continuously improve image quality
  if (imageUpdates.size > 0 && isRealSql) {
    try {
      // Get all components from our update set (including those with existing images)
      const componentIds = [...imageUpdates.keys()];
      const components = (await bunSql`
        SELECT id, name, image_url FROM components
        WHERE id IN ${bunSql(componentIds)}
      `) as { id: number; name: string; image_url: string | null }[];

      let imagesUpdated = 0;
      let imagesImproved = 0;

      for (const component of components) {
        const newImageData = imageUpdates.get(component.id);
        if (!newImageData || newImageData.score < 0) continue; // Skip only truly bad images (placeholders)

        if (!component.image_url) {
          // Component has no image - add one
          await bunSql`
            UPDATE components SET image_url = ${newImageData.url}
            WHERE id = ${component.id}
          `;
          imagesUpdated++;
        } else {
          // Component has an image - check if new one is better
          const currentScore = scoreImageQuality(component.image_url, component.name);
          if (newImageData.score > currentScore) {
            await bunSql`
              UPDATE components SET image_url = ${newImageData.url}
              WHERE id = ${component.id}
            `;
            imagesImproved++;
          }
        }
      }

      if (imagesUpdated > 0 || imagesImproved > 0) {
        await logger.info(`[PIPELINE] Images: ${imagesUpdated} added, ${imagesImproved} improved (replaced lower quality)`);
      }
    } catch (err) {
      await logger.error(`[PIPELINE] Image backfill failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Phase 6: Mark Out-of-Stock — bulk update per retailer
  // Safety threshold: only mark OOS if current scrape returned ≥ 50% of the previous
  // run's count. Protects against partial scrapes (network errors, rate limits) wiping
  // valid stock status for thousands of products.
  if (isRealSql && prices.length > 0 && !skipStockSync) {
    for (const rid of retailerIds) {
      const currentUrlsForRid = new Set(
        prices.filter(p => p.retailer_id === rid).map(p => p.product_url)
      );
      try {
        // Get all in-stock URLs for this retailer, then bulk-update the ones not in current scrape
        const inStockUrls = (await bunSql`
          SELECT product_url FROM prices WHERE retailer_id = ${rid} AND in_stock = true
        `) as { product_url: string }[];

        const previousInStockCount = inStockUrls.length;
        const currentCountForRid = currentUrlsForRid.size;

        // Threshold check: if we scraped fewer than 50% of previously known in-stock items,
        // the scrape was likely partial/failed — skip OOS marking to avoid data corruption.
        const OOS_THRESHOLD = 0.5;
        if (previousInStockCount > 0 && currentCountForRid < previousInStockCount * OOS_THRESHOLD) {
          await logger.warn(
            `[PIPELINE] Retailer ${rid}: scraped ${currentCountForRid} items vs ${previousInStockCount} previously in-stock — below ${OOS_THRESHOLD * 100}% threshold, skipping OOS marking to protect data integrity`
          );
          continue;
        }

        const toMarkOos = inStockUrls.map(r => r.product_url).filter(u => !currentUrlsForRid.has(u));
        if (toMarkOos.length > 0) {
          for (let i = 0; i < toMarkOos.length; i += 1000) {
            const batch = toMarkOos.slice(i, i + 1000);
            await bunSql`
              UPDATE prices SET in_stock = false, last_updated = NOW()
              WHERE retailer_id = ${rid} AND product_url IN ${bunSql(batch)} AND in_stock = true
            `;
          }
        }
      } catch { /* ignore */ }
    }
  }

  // Phase 7: Global Cleanup
  if (isRealSql && finalResolved.length > 0) {
    try {
      const resolvedUrls = finalResolved.map(p => p.product_url);
      for (let i = 0; i < resolvedUrls.length; i += 1000) {
        const batch = resolvedUrls.slice(i, i + 1000);
        await sql`DELETE FROM unmatched_suggestions WHERE unmatched_listing_id IN (SELECT id FROM unmatched_listings WHERE product_url IN ${sql(batch)})`;
        await sql`DELETE FROM unmatched_listings WHERE product_url IN ${sql(batch)}`;
      }
    } catch { /* ignore */ }
  }

  const logParts = [
    `${updated} updated`,
    `${unmatched} unmatched`,
    ...(autoMapped > 0 ? [`${autoMapped} auto-mapped`] : []),
    ...(autoCreated > 0 ? [`${autoCreated} auto-created`] : []),
    ...(errors > 0 ? [`${errors} error(s)`] : []),
  ];
  await logger.info(`[PIPELINE] Scraping complete: ${logParts.join(', ')}`);
  return { updated, unmatched, errors, autoMapped, autoCreated };
}

/**
 * Manually re-processes all pending unmatched listings through the unified pipeline.
 * Used by the "Retraiter" button in the admin panel.
 */
export async function reprocessUnmatched(): Promise<AggregateResult & { autoMapped: number; autoCreated: number }> {
  const sql = getSql();
  type UnmatchedListing = { id: number; retailer_id: number; product_url: string; scraped_name: string; scraped_price: number; manual_category: string | null };

  const items = (await sql`
    SELECT ul.*, us.category as sug_category
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    WHERE ul.status = 'pending'
  `) as (UnmatchedListing & { sug_category?: string })[];

  if (items.length === 0) return { updated: 0, unmatched: 0, errors: 0, autoMapped: 0, autoCreated: 0 };

  const prices: ScrapedPrice[] = items.map(item => ({
    retailer_id: item.retailer_id,
    product_url: item.product_url,
    product_name: item.scraped_name,
    price: Number(item.scraped_price),
    in_stock: true,
    product_description: '',
    manual_category: item.manual_category ?? undefined,
    sug_category: item.sug_category
  } as any));

  // Run the unified pipeline, but skip stock syncing!
  return aggregate(prices, undefined, { skipStockSync: true });
}
