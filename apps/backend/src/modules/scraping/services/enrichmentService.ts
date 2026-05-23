import { getSql } from '../../../core/db/index.js';
import * as cheerio from 'cheerio';
import PQueue from 'p-queue';
import { logger } from '../engine/utils/logger.js';
import { getDynamicEnrichment } from '@shared/hardware/services/dynamicEnrichment';
import { dbHardwareCache } from './dynamicEnrichmentService.js';
import { scrapeProductPage } from '../utils/deepScraper.js';
import { normalizeEfficiencyRating, normalizeModularity, normalizePsuFormFactor } from '@shared/hardware/specs/psu';

const sql = getSql();

/**
 * Tier 1: Smart Inference (Architectural logic)
 * Uses high-performance bulk updates to avoid per-row database round-trips.
 */
export async function runSmartBackfill() {
    await logger.info('[ENRICHMENT] Starting Smart Backfill (Bulk Inference)...');

    // 1. CPU Sockets - Multi-match in a single UPDATE
    const cpuUpdate = await sql`
        UPDATE components 
        SET socket = CASE 
            WHEN name ~* '\\bam4\\b' THEN 'AM4'
            WHEN name ~* '\\bam5\\b' THEN 'AM5'
            WHEN name ~* '\\blga\\s*1700\\b' THEN 'LGA1700'
            WHEN name ~* '\\blga\\s*1851\\b' THEN 'LGA1851'
            WHEN name ~* '\\blga\\s*1200\\b' THEN 'LGA1200'
            WHEN name ~* '\\blga\\s*1151\\b' THEN 'LGA1151'
            ELSE socket
        END
        WHERE category = 'cpu' AND socket IS NULL
          AND name ~* '\\b(am4|am5|lga\\s*1700|lga\\s*1851|lga\\s*1200|lga\\s*1151)\\b'
    ` as any;
    if (cpuUpdate.count > 0) await logger.info(`[ENRICHMENT] Smart: Inferred socket for ${cpuUpdate.count} CPUs`);

    // 2. Motherboard M.2 Slots
    const mbUpdate = await sql`
        UPDATE components SET m2_slots = 
            CASE 
                WHEN name ~* '(Z790|Z690|X670|X870|X570)' THEN 3
                WHEN name ~* '(B760|B660|B650|B550|H770|H670)' THEN 2
                ELSE 1
            END
        WHERE category = 'motherboard' AND m2_slots IS NULL
          AND name ~* '(Z790|Z690|X670|X870|X570|B760|B660|B650|B550|H770|H670)'
    ` as any;
    if (mbUpdate.count > 0) await logger.info(`[ENRICHMENT] Smart: Inferred M.2 slots for ${mbUpdate.count} motherboards`);

    // 3. Case Compatibility
    const caseUpdate = await sql`
        UPDATE components SET supported_motherboards = 
            CASE 
                WHEN name ~* '(ATX|Full Tower|Middle Tower|Moyenne Tour)' THEN ARRAY['ATX', 'mATX', 'Mini-ITX']
                WHEN name ~* '(mATX|Micro ATX|Micro-ATX)' THEN ARRAY['mATX', 'Mini-ITX']
                WHEN name ~* '(Mini-ITX|Mini ITX)' THEN ARRAY['Mini-ITX']
                WHEN name ~* '(E-ATX|Eatx)' THEN ARRAY['E-ATX', 'ATX', 'mATX', 'Mini-ITX']
                ELSE supported_motherboards
            END
        WHERE category = 'case' AND supported_motherboards IS NULL
          AND name ~* '(ATX|Tower|Tour|Mini-ITX|Mini ITX|mATX|Micro ATX|Micro-ATX)'
    ` as any;
    if (caseUpdate.count > 0) await logger.info(`[ENRICHMENT] Smart: Inferred motherboard support for ${caseUpdate.count} cases`);

    // 4. Storage Capacity (Normalization)
    const storageUpdate = await sql`
        UPDATE components SET capacity_gb = 
            CASE 
                WHEN name ~* '([0-9]+)\\s*(TB|TO)' THEN (substring(name from '([0-9]+)\\s*(?i)(TB|TO)')::int * 1024)
                WHEN name ~* '([0-9]+)\\s*(GB|Go)' THEN substring(name from '([0-9]+)\\s*(?i)(GB|Go)')::int
                ELSE capacity_gb
            END
        WHERE category = 'storage' AND capacity_gb IS NULL
          AND name ~* '[0-9]+\\s*(GB|Go|TB|TO)'
    ` as any;
    if (storageUpdate.count > 0) await logger.info(`[ENRICHMENT] Smart: Normalized capacity for ${storageUpdate.count} storage devices`);
}

/**
 * Tier 2: Deep Scraper (Visit product pages for technical sheets & galleries)
 */
export async function runDeepRetailerBackfill() {
    const BATCH_SIZE = 100; // Controlled batch size for AI/Scraping
    const queue = new PQueue({ concurrency: 2 }); // Lower concurrency to avoid bans

    // 1. Count total pending
    const [{ count: totalPending }] = await sql`
        SELECT count(*)::int FROM components
        WHERE is_active = true
          AND (
            (category = 'storage' AND capacity_gb IS NULL) OR
            (category = 'cooling' AND tdp IS NULL) OR
            (category = 'ram' AND (capacity_gb IS NULL OR cas_latency IS NULL)) OR
            (category = 'motherboard' AND (socket IS NULL OR supported_ram_types IS NULL)) OR
            (category = 'psu' AND (wattage IS NULL OR efficiency_rating IS NULL OR modular IS NULL)) OR
            (image_urls IS NULL OR array_length(image_urls, 1) < 2)
          )
    ` as { count: number }[];

    if (totalPending === 0) return;

    // 2. Fetch the current batch
    const rows = await sql`
        SELECT id, name, category, image_urls,
          (SELECT array_agg(product_url) FROM prices WHERE component_id = components.id LIMIT 3) as product_urls
        FROM components
        WHERE is_active = true
          AND (
            (category = 'storage' AND capacity_gb IS NULL) OR
            (category = 'cooling' AND tdp IS NULL) OR
            (category = 'ram' AND (capacity_gb IS NULL OR cas_latency IS NULL)) OR
            (category = 'motherboard' AND (socket IS NULL OR supported_ram_types IS NULL)) OR
            (category = 'psu' AND (wattage IS NULL OR efficiency_rating IS NULL OR modular IS NULL)) OR
            (image_urls IS NULL OR array_length(image_urls, 1) < 2)
          )
        ORDER BY updated_at ASC
        LIMIT ${BATCH_SIZE}
    ` as { id: number; name: string; category: string; image_urls: string[] | null; product_urls: string[] }[];

    await logger.info(`[ENRICHMENT] Deep: Progress ${rows.length}/${totalPending} components pending enrichment...`);

    let successCount = 0;
    for (const row of rows) {
        if (!row.product_urls || row.product_urls.length === 0) continue;

        queue.add(async () => {
            try {
                // Visit the first available URL for full spec extraction
                const url = row.product_urls[0];
                
                // Use the new deterministic MPN-driven resolution service
                const resolved = await getDynamicEnrichment(
                    row.name,
                    row.category,
                    dbHardwareCache,
                    url,
                    scrapeProductPage
                );

                const updates: Record<string, any> = {};
                if (resolved) {
                    if (resolved.mpn) updates.mpn = resolved.mpn;
                    if (resolved.ean) updates.ean = resolved.ean;
                    
                    // Map resolved specs to columns
                    if (row.category === 'ram') {
                        if (resolved.ram_type) updates.ram_type = resolved.ram_type;
                        if (resolved.cas_latency) updates.cas_latency = resolved.cas_latency;
                        if (resolved.frequency_mhz) updates.frequency_mhz = resolved.frequency_mhz;
                        if (resolved.capacity_gb) updates.capacity_gb = resolved.capacity_gb;
                    } else if (row.category === 'motherboard') {
                        if (resolved.socket) updates.socket = resolved.socket;
                        if (resolved.form_factor) updates.form_factor = resolved.form_factor;
                    } else if (row.category === 'storage') {
                        if (resolved.capacity_gb) updates.capacity_gb = resolved.capacity_gb;
                    } else if (row.category === 'cooling') {
                        if (resolved.tdp) updates.tdp = resolved.tdp;
                    } else if (row.category === 'psu') {
                        if (resolved.wattage) updates.wattage = resolved.wattage;
                        if (resolved.efficiency) updates.efficiency_rating = normalizeEfficiencyRating(resolved.efficiency as string);
                        if (resolved.efficiency_rating) updates.efficiency_rating = normalizeEfficiencyRating(resolved.efficiency_rating);
                        if (resolved.modularity) updates.modular = normalizeModularity(resolved.modularity as string);
                        if (resolved.modular) updates.modular = normalizeModularity(resolved.modular);
                        if (resolved.form_factor) updates.psu_form_factor = normalizePsuFormFactor(resolved.form_factor as string);
                        if (resolved.psu_form_factor) updates.psu_form_factor = normalizePsuFormFactor(resolved.psu_form_factor);
                    }
                }

                // Still handle image extraction manually or update deepScraper to handle it
                const currentImages = new Set(row.image_urls || []);
                if (currentImages.size < 2) {
                    try {
                        const res = await fetch(url, { 
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
                        });
                        if (res.ok) {
                            const html = await res.text();
                            const $ = cheerio.load(html);
                            $('.product-images img, .js-modal-product-cover, #product-images-large img, .js-thumb, .woocommerce-product-gallery__image img').each((_, img) => {
                                const src = $(img).attr('data-image-large-src') || $(img).attr('data-src') || $(img).attr('src');
                                if (src && src.startsWith('http')) currentImages.add(src);
                            });
                            if (currentImages.size > (row.image_urls?.length || 0)) {
                                updates.image_urls = Array.from(currentImages).slice(0, 3);
                            }
                        }
                    } catch { /* ignore fetch errors for images */ }
                }

                if (Object.keys(updates).length > 0) {
                    await sql`UPDATE components SET ${sql(updates)}, updated_at = NOW() WHERE id = ${row.id}`;
                    successCount++;
                }
            } catch (err) {
                console.error(`[ENRICHMENT] Failed for ${row.name}:`, err);
            }
        });
    }
    await queue.onIdle();
    if (successCount > 0) await logger.info(`[ENRICHMENT] Deep: Successfully enriched ${successCount} components`);
}
