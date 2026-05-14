import { getSql } from '../../../core/db/index.js';
import * as cheerio from 'cheerio';
import PQueue from 'p-queue';
import { logger } from '../engine/utils/logger.js';

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
    const BATCH_SIZE = 500; // Increased batch to clear backlog faster
    const queue = new PQueue({ concurrency: 3 });

    // 1. Count total pending to give user feedback
    const [{ count: totalPending }] = await sql`
        SELECT count(*)::int FROM components
        WHERE is_active = true
          AND (
            (category = 'storage' AND capacity_gb IS NULL) OR
            (category = 'cooling' AND tdp IS NULL) OR
            (category = 'ram' AND capacity_gb IS NULL) OR
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
            (category = 'ram' AND capacity_gb IS NULL) OR
            (image_urls IS NULL OR array_length(image_urls, 1) < 2)
          )
        ORDER BY updated_at ASC -- Process oldest first
        LIMIT ${BATCH_SIZE}
    ` as { id: number; name: string; category: string; image_urls: string[] | null; product_urls: string[] }[];

    await logger.info(`[ENRICHMENT] Deep: Progress ${rows.length}/${totalPending} components pending enrichment...`);

    let successCount = 0;
    for (const row of rows) {
        if (!row.product_urls || row.product_urls.length === 0) continue;

        queue.add(async () => {
            try {
                // Random delay between 500ms and 1500ms per component to be stealthy
                await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));

                const updates: Record<string, any> = {};
                const currentImages = new Set(row.image_urls || []);


                for (const url of row.product_urls) {
                    if (currentImages.size >= 3 && Object.keys(updates).length > 0) break;

                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

                    try {
                        const res = await fetch(url, { 
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                            signal: controller.signal
                        });
                        clearTimeout(timeout);
                        if (!res.ok) continue;
                        const html = await res.text();
                        const $ = cheerio.load(html);

                        // Image Gallery Extraction
                        $('.product-images img, .js-modal-product-cover, #product-images-large img, .js-thumb, .woocommerce-product-gallery__image img, .product-image-container img').each((_, img) => {
                            const src = $(img).attr('data-image-large-src') || $(img).attr('data-src') || $(img).attr('src') || $(img).attr('data-zoom-image');
                            if (src && src.startsWith('http')) {
                                const cleanSrc = src.replace(/-(small|home|medium|cart)_default\//, '-large_default/')
                                                   .replace(/\?.*$/, '');
                                currentImages.add(cleanSrc);
                            }
                        });
                        if (currentImages.size > (row.image_urls?.length || 0)) {
                            updates.image_urls = Array.from(currentImages).slice(0, 3);
                        }

                        // Specs Extraction
                        const dataAttr = $('#product-details').attr('data-product');
                        if (dataAttr) {
                            const productData = JSON.parse(dataAttr);
                            const features = productData.features || [];
                            for (const f of features) {
                                const fname = f.name.toLowerCase();
                                const fval = f.value;
                                if (row.category === 'storage' && (fname.includes('capacité') || fname.includes('capacity'))) {
                                    const cap = parseInt(fval.match(/(\d+)/)?.[1] || '0');
                                    updates.capacity_gb = fval.toLowerCase().includes('tb') || fval.toLowerCase().includes('to') ? cap * 1024 : cap;
                                }
                            }
                        }
                    } catch {
                        clearTimeout(timeout);
                    }
                }

                if (Object.keys(updates).length > 0) {
                    await sql`UPDATE components SET ${sql(updates)} WHERE id = ${row.id}`;
                    successCount++;
                }
            } catch { /* skip */ }
        });
    }
    await queue.onIdle();
    if (successCount > 0) await logger.info(`[ENRICHMENT] Deep: Successfully enriched ${successCount} components`);
}
