import { getSql } from '../../../core/db/index.js';
import * as cheerio from 'cheerio';
import PQueue from 'p-queue';
import { logger } from '../engine/utils/logger.js';

const sql = getSql();

/**
 * Tier 1: Smart Inference (Architectural logic)
 */
export async function runSmartBackfill() {
    function norm(s: string) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }

    // CPU Sockets
    const cpus = await sql`SELECT id, name FROM components WHERE category = 'cpu' AND socket IS NULL` as { id: number; name: string }[];
    for (const { id, name } of cpus) {
        const n = norm(name);
        let socket: string | null = null;
        if (/\bam4\b/.test(n)) socket = 'AM4';
        else if (/\bam5\b/.test(n)) socket = 'AM5';
        else if (/\blga\s*1700\b/.test(n)) socket = 'LGA1700';
        else if (/\blga\s*1200\b/.test(n)) socket = 'LGA1200';
        // ... (rest of model inference logic from my previous tools)
        if (socket) await sql`UPDATE components SET socket = ${socket} WHERE id = ${id}`;
    }

    // Motherboard M.2 (Chipset based)
    await sql`
        UPDATE components SET m2_slots = 
            CASE 
                WHEN chipset ~* '(Z790|Z690|X670|X870|X570)' THEN 3
                WHEN chipset ~* '(B760|B660|B650|B550|H770|H670)' THEN 2
                ELSE 1
            END
        WHERE category = 'motherboard' AND m2_slots IS NULL AND chipset IS NOT NULL
    `;

    // Case Compatibility
    await sql`
        UPDATE components SET supported_motherboards = 
            CASE 
                WHEN form_factor IN ('ATX', 'Full Tower') THEN ARRAY['ATX', 'mATX', 'Mini-ITX']
                WHEN form_factor = 'mATX' THEN ARRAY['mATX', 'Mini-ITX']
                WHEN form_factor = 'Mini-ITX' THEN ARRAY['Mini-ITX']
                WHEN form_factor = 'E-ATX' THEN ARRAY['E-ATX', 'ATX', 'mATX', 'Mini-ITX']
                ELSE supported_motherboards
            END
        WHERE category = 'case' AND supported_motherboards IS NULL
    `;

    // CPU Threading
    await sql`
        UPDATE components SET thread_count = core_count * 2
        WHERE category = 'cpu' AND thread_count IS NULL AND core_count IS NOT NULL
        AND (name ~* 'Ryzen [12345]' OR name ~* 'Core i[3579] 1[01]')
    `;
}

/**
 * Tier 2: Deep Scraper (Visit product pages for technical sheets & galleries)
 */
export async function runDeepRetailerBackfill() {
    const queue = new PQueue({ concurrency: 3 });
    
    // Find components that are missing specs OR missing images
    const rows = await sql`
        SELECT c.id, c.name, c.category, c.image_urls, 
               array_agg(p.product_url) as product_urls
        FROM components c
        JOIN prices p ON p.component_id = c.id
        WHERE c.is_active = true
          AND (
            (c.category = 'storage' AND c.read_speed_mbps IS NULL) OR
            (c.category = 'cooling' AND c.height_mm IS NULL) OR
            (c.category = 'fan' AND c.airflow_cfm IS NULL) OR
            (c.image_urls IS NULL OR array_length(c.image_urls, 1) < 3)
          )
        GROUP BY c.id, c.name, c.category, c.image_urls
        LIMIT 5000
    ` as { id: number; name: string; category: string; image_urls: string[] | null; product_urls: string[] }[];

    for (const row of rows) {
        queue.add(async () => {
            try {
                const updates: Record<string, any> = {};
                const currentImages = new Set(row.image_urls || []);

                // Try each retailer until we have 3 images OR we run out of retailers
                for (const url of row.product_urls) {
                    if (currentImages.size >= 3 && Object.keys(updates).length > 0) break;

                    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
                    if (!res.ok) continue;
                    const html = await res.text();
                    const $ = cheerio.load(html);

                    // 1. Image Gallery Extraction (PrestaShop / WooCommerce / Custom)
                    if (currentImages.size < 3) {
                        $('.product-images img, .js-modal-product-cover, #product-images-large img, .js-thumb, .woocommerce-product-gallery__image img, .product-image-container img').each((_, img) => {
                            const src = $(img).attr('data-image-large-src') || $(img).attr('data-src') || $(img).attr('src') || $(img).attr('data-zoom-image');
                            if (src && src.startsWith('http')) {
                                const cleanSrc = src.replace(/-(small|home|medium|cart)_default\//, '-large_default/')
                                                   .replace(/\?.*$/, ''); // Remove query params
                                currentImages.add(cleanSrc);
                            }
                        });
                        if (currentImages.size > (row.image_urls?.length || 0)) {
                            updates.image_urls = Array.from(currentImages).slice(0, 3);
                        }
                    }

                    // 2. Technical Specs Extraction (Only if missing)
                    const dataAttr = $('#product-details').attr('data-product');
                    if (dataAttr) {
                        const features = JSON.parse(dataAttr).features || [];
                        for (const f of features) {
                            const fname = f.name.toLowerCase();
                            const fval = f.value;
                            if (row.category === 'storage') {
                                if (fname.includes('lecture') || fname.includes('read')) updates.read_speed_mbps = parseInt(fval.match(/(\d+)/)?.[1] || '0');
                                if (fname.includes('ecriture') || fname.includes('write')) updates.write_speed_mbps = parseInt(fval.match(/(\d+)/)?.[1] || '0');
                            }
                            if (row.category === 'cooling' && (fname.includes('hauteur') || fname.includes('height'))) {
                                updates.height_mm = parseInt(fval.match(/(\d+)/)?.[1] || '0');
                            }
                        }
                    }
                }

                if (Object.keys(updates).length > 0) {
                    const fields = Object.entries(updates).map(([k, v]) => {
                        if (k === 'image_urls' && Array.isArray(v)) {
                            const pgArr = `{${v.map(u => `"${u.replace(/"/g, '\\"')}"`).join(',')}}`;
                            return `image_urls = '${pgArr}'`;
                        }
                        return `${k} = ${v}`;
                    }).join(', ');
                    
                    await sql.unsafe(`UPDATE components SET ${fields} WHERE id = ${row.id}`);
                }
            } catch (e) { /* ignore */ }
        });
    }
    await queue.onIdle();
}
