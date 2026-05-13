import { getSql } from '../../../core/db/index.js';
import * as cheerio from 'cheerio';
import PQueue from 'p-queue';
import { logger } from '../engine/utils/logger.js';

const sql = getSql();

/**
 * Tier 1: Smart Inference (Architectural logic)
 */
export async function runSmartBackfill() {
    await logger.info('[ENRICHMENT] Starting Smart Backfill (Inference)...');
    function norm(s: string) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }

    // CPU Sockets
    const cpus = await sql`SELECT id, name FROM components WHERE category = 'cpu' AND socket IS NULL` as { id: number; name: string }[];
    let cpuCount = 0;
    for (const { id, name } of cpus) {
        const n = norm(name);
        let socket: string | null = null;
        if (/\bam4\b/.test(n)) socket = 'AM4';
        else if (/\bam5\b/.test(n)) socket = 'AM5';
        else if (/\blga\s*1700\b/.test(n)) socket = 'LGA1700';
        else if (/\blga\s*1851\b/.test(n)) socket = 'LGA1851';
        else if (/\blga\s*1200\b/.test(n)) socket = 'LGA1200';
        
        if (socket) {
            await sql`UPDATE components SET socket = ${socket} WHERE id = ${id}`;
            cpuCount++;
        }
    }
    if (cpuCount > 0) await logger.info(`[ENRICHMENT] Smart: Inferred socket for ${cpuCount} CPUs`);

    // Motherboard M.2 (Chipset based)
    const mbUpdate = await sql`
        UPDATE components SET m2_slots = 
            CASE 
                WHEN name ~* '(Z790|Z690|X670|X870|X570)' THEN 3
                WHEN name ~* '(B760|B660|B650|B550|H770|H670)' THEN 2
                ELSE 1
            END
        WHERE category = 'motherboard' AND m2_slots IS NULL
    `;
    if (mbUpdate.count > 0) await logger.info(`[ENRICHMENT] Smart: Inferred M.2 slots for ${mbUpdate.count} motherboards`);

    // Case Compatibility
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
    `;
    if (caseUpdate.count > 0) await logger.info(`[ENRICHMENT] Smart: Inferred motherboard support for ${caseUpdate.count} cases`);
}

/**
 * Tier 2: Deep Scraper (Visit product pages for technical sheets & galleries)
 */
export async function runDeepRetailerBackfill() {
    const BATCH_SIZE = 100; // Limit per run to avoid hanging
    const queue = new PQueue({ concurrency: 3 });
    
    // Find components that are missing specs OR missing images
    const rows = await sql`
        SELECT c.id, c.name, c.category, c.image_urls, 
               array_agg(p.product_url) as product_urls
        FROM components c
        JOIN prices p ON p.component_id = c.id
        WHERE c.is_active = true
          AND (
            (c.category = 'storage' AND c.capacity_gb IS NULL) OR
            (c.category = 'cooling' AND c.tdp IS NULL) OR
            (c.category = 'ram' AND c.capacity_gb IS NULL) OR
            (c.image_urls IS NULL OR array_length(c.image_urls, 1) < 2)
          )
        GROUP BY c.id, c.name, c.category, c.image_urls
        LIMIT ${BATCH_SIZE}
    ` as { id: number; name: string; category: string; image_urls: string[] | null; product_urls: string[] }[];

    if (rows.length === 0) return;
    await logger.info(`[ENRICHMENT] Deep: Processing ${rows.length} components for spec/image backfill...`);

    let successCount = 0;
    for (const row of rows) {
        queue.add(async () => {
            try {
                const updates: Record<string, any> = {};
                const currentImages = new Set(row.image_urls || []);

                // Try each retailer until we have 3 images OR we run out of retailers
                for (const url of row.product_urls) {
                    if (currentImages.size >= 3 && Object.keys(updates).length > 0) break;

                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

                    try {
                        const res = await fetch(url, { 
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                            signal: controller.signal
                        });
                        clearTimeout(timeout);
                        if (!res.ok) continue;
                        const html = await res.text();
                        const $ = cheerio.load(html);

                        // 1. Image Gallery Extraction
                        if (currentImages.size < 3) {
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
                        }

                        // 2. Technical Specs Extraction
                        const dataAttr = $('#product-details').attr('data-product');
                        if (dataAttr) {
                            const productData = JSON.parse(dataAttr);
                            const features = productData.features || [];
                            for (const f of features) {
                                const fname = f.name.toLowerCase();
                                const fval = f.value;
                                if (row.category === 'storage') {
                                    if (fname.includes('capacité') || fname.includes('capacity')) {
                                        const cap = parseInt(fval.match(/(\d+)/)?.[1] || '0');
                                        if (fval.toLowerCase().includes('tb') || fval.toLowerCase().includes('to')) {
                                            updates.capacity_gb = cap * 1024;
                                        } else {
                                            updates.capacity_gb = cap;
                                        }
                                    }
                                }
                            }
                        }
                    } catch (fetchErr) {
                        clearTimeout(timeout);
                    }
                }

                if (Object.keys(updates).length > 0) {
                    // Filter out undefined values
                    const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined));
                    if (Object.keys(cleanUpdates).length > 0) {
                        await sql`UPDATE components SET ${sql(cleanUpdates)} WHERE id = ${row.id}`;
                        successCount++;
                    }
                }
            } catch (e) { /* ignore */ }
        });
    }
    await queue.onIdle();
    if (successCount > 0) await logger.info(`[ENRICHMENT] Deep: Successfully enriched ${successCount} components`);
}

