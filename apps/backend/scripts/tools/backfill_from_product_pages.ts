import { sql } from 'bun';
import * as cheerio from 'cheerio';
import PQueue from 'p-queue';

const queue = new PQueue({ concurrency: 10 });

function extractSpecsGeneric($: cheerio.CheerioAPI): Record<string, string> {
    const specs: Record<string, string> = {};
    
    // 1. PrestaShop JSON
    const dataAttr = $('#product-details').attr('data-product');
    if (dataAttr) {
        try {
            const productData = JSON.parse(dataAttr);
            const features = productData.features || [];
            for (const feat of features) {
                specs[feat.name.toLowerCase().trim()] = feat.value.trim();
            }
        } catch(e) {}
    }

    // 2. Tables
    $('tr').each((_, el) => {
        const ths = $(el).find('th');
        const tds = $(el).find('td');
        if (ths.length === 1 && tds.length === 1) {
            specs[ths.text().toLowerCase().trim()] = tds.text().trim();
        } else if (tds.length === 2) {
            specs[tds.eq(0).text().toLowerCase().trim()] = tds.eq(1).text().trim();
        } else if (tds.length === 1) {
            const text = tds.text().trim();
            if (text.includes(':')) {
                const parts = text.split(':');
                specs[parts[0].toLowerCase().trim()] = parts.slice(1).join(':').trim();
            }
        }
    });

    // 3. DL/DT (Corrected for PrestaShop layout)
    $('#product-details .features dl dt').each((_, el) => {
        const dt = $(el);
        const dd = dt.next('dd');
        if (dd.length > 0) {
            specs[dt.text().toLowerCase().trim()] = dd.text().trim();
        }
    });

    // 4. WooCommerce (SetupGame)
    $('.woocommerce-product-attributes-item').each((_, el) => {
        const th = $(el).find('.woocommerce-product-attributes-item__label').text().toLowerCase().trim();
        const td = $(el).find('.woocommerce-product-attributes-item__value').text().trim();
        if (th && td) {
            specs[th] = td;
        }
    });

    // 5. Fallback to Description for CAS Latency
    if (!specs['cas latency'] && !specs['latence']) {
        const desc = $('.product-description').text();
        const clMatch = desc.match(/CL\s*(\d+)/i);
        if (clMatch) specs['description_cl'] = clMatch[1];
    }

    return specs;
}

function mapSpecs(extracted: Record<string, string>, category: string, name: string) {
    const result: Record<string, any> = {};
    
    // Add name-based extraction as primary fallback
    if (category === 'ram') {
        const clMatch = name.match(/CL\s*(\d+)/i);
        if (clMatch) result.cas_latency = parseInt(clMatch[1]);
    }

    for (const [rawKey, val] of Object.entries(extracted)) {
        if (!val) continue;
        const key = rawKey.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const cleanVal = val.toLowerCase().replace(/,/g, '.');

        if (category === 'ram') {
            if (key.match(/type/)) {
                if (val.match(/DDR4/i)) result.ram_type = 'DDR4';
                if (val.match(/DDR5/i)) result.ram_type = 'DDR5';
            }
            if (key.match(/frequence|vitesse|speed/)) {
                const freq = parseInt(val.match(/(\d{3,})/)?.[1] || '0');
                if (freq > 0) result.frequency_mhz = freq;
            }
            if (key.match(/capacite|capacity/)) {
                const total = parseInt(val.match(/(\d+)\s*(gb|go)/i)?.[1] || '0');
                const sticks = parseInt(val.match(/(\d+)\s*x/i)?.[1] || '1');
                if (total) {
                    result.capacity_gb = sticks > 1 ? total / sticks : total;
                    result.kit_count = sticks;
                }
            }
            if (key.match(/cas|latency|latence|description_cl/)) {
                const cl = parseInt(val.match(/CL(\d+)/i)?.[1] || val.match(/(\d+)/)?.[1] || '0');
                if (cl > 0) result.cas_latency = cl;
            }
        }
        else if (category === 'storage') {
            if (key.match(/lecture|read/)) result.read_speed_mbps = parseInt(val.match(/(\d{3,})/)?.[1] || '0');
            if (key.match(/ecriture|write/)) result.write_speed_mbps = parseInt(val.match(/(\d{3,})/)?.[1] || '0');
            if (key.match(/capacite|capacity/)) {
                if (val.match(/tb|to/i)) result.capacity_gb = parseInt(val.match(/(\d+)/)?.[1] || '0') * 1000;
                else if (val.match(/gb|go/i)) result.capacity_gb = parseInt(val.match(/(\d+)/)?.[1] || '0');
            }
        }
        else if (category === 'cooling' || category === 'fan') {
            if (key.match(/hauteur|height/)) result.height_mm = parseInt(val.match(/(\d{2,})/)?.[1] || '0');
            if (key.match(/bruit|noise/)) result.noise_db = parseFloat(cleanVal.match(/(\d+\.?\d*)/)?.[1] || '0');
            if (key.match(/flux|airflow/)) result.airflow_cfm = parseFloat(cleanVal.match(/(\d+\.?\d*)/)?.[1] || '0');
            if (key.match(/tdp/)) result.max_tdp = parseInt(val.match(/(\d{2,})/)?.[1] || '0');
            if (key.match(/taille|size/)) result.size_mm = parseInt(val.match(/(\d{2,})/)?.[1] || '0');
        }
        else if (category === 'cpu') {
            if (key.match(/coeur|core|cores/) && !key.match(/clock|frequence/)) {
                const match = val.match(/(\d+)/);
                if (match) {
                    const c = parseInt(match[1]);
                    if (c > 0 && c < 128) result.core_count = c;
                }
            }
            if (key.match(/thread/)) {
                const match = val.match(/(\d+)/);
                if (match) {
                    const t = parseInt(match[1]);
                    if (t > 0 && t < 256) result.thread_count = t;
                }
            }
            if (key.match(/tdp|puissance|consommation/)) result.tdp = parseInt(val.match(/(\d{2,})/)?.[1] || '0');
            if (key.match(/socket|support/)) {
                const s = val.replace(/\s+/g, '').toUpperCase().match(/(LGA\d+|AM[45]|STR\w+|TR4)/i)?.[1];
                if (s) result.socket = s;
            }
            if (key.match(/base.*ghz|frequence|clock/)) {
                const m = cleanVal.match(/(\d+\.\d+)\s*ghz/);
                if (m) result.base_clock_ghz = parseFloat(m[1]);
            }
            if (key.match(/turbo|boost/)) {
                const m = cleanVal.match(/(\d+\.\d+)\s*ghz/);
                if (m) result.boost_clock_ghz = parseFloat(m[1]);
            }
        }
        else if (category === 'gpu') {
            if (key.match(/longueur|length|dimension/)) result.length_mm = parseInt(val.match(/(\d{3})/)?.[1] || '0');
            if (key.match(/tdp|consommation/)) result.tdp = parseInt(val.match(/(\d{2,})/)?.[1] || '0');
            if (key.match(/memoire|memory|vram/) && val.match(/gb|go/i)) {
                result.vram_gb = parseInt(val.match(/(\d+)\s*(gb|go)/i)?.[1] || '0');
            }
            if (key.match(/puce|chipset/)) {
                const m = val.match(/(RTX\s*\d{4}(?:\s*Ti|\s*SUPER)?|RX\s*\d{4}(?:\s*XTX|\s*XT)?|GTX\s*\d{4}(?:\s*Ti|\s*SUPER)?)/i);
                if (m) result.chipset = m[1].toUpperCase();
            }
        }
        else if (category === 'motherboard') {
            if (key.match(/socket|support/)) {
                const s = val.replace(/\s+/g, '').toUpperCase().match(/(LGA\d+|AM[45]|STR\w+|TR4)/i)?.[1];
                if (s) result.socket = s;
            }
            if (key.match(/chipset/)) {
                const c = val.match(/([A-Z]\d{3}[A-Z]?)/i)?.[1];
                if (c) result.chipset = c.toUpperCase();
            }
            if (key.match(/memoire|memory|ram|type/) && val.match(/DDR[45]/i)) {
                if (val.match(/DDR4/i)) result.supported_ram_types = ['DDR4'];
                if (val.match(/DDR5/i)) result.supported_ram_types = ['DDR5'];
            }
            if (key.match(/format/)) {
                const m = val.match(/(ATX|MICRO\s*-?\s*ATX|MINI\s*-?\s*ITX|E-ATX|M-ATX|ITX)/i);
                if (m) {
                    let ff = m[1].toUpperCase().replace(/\s+/g, '').replace('MICRO-ATX', 'mATX').replace('M-ATX', 'mATX');
                    result.form_factor = ff;
                }
            }
        }
        else if (category === 'psu') {
            if (key.match(/puissance|power|watt/)) {
                result.wattage = parseInt(val.match(/(\d{3,})/)?.[1] || '0');
            }
            if (key.match(/certif|80\s*plus/)) {
                if (val.match(/bronze/i)) result.efficiency_rating = 'Bronze';
                else if (val.match(/gold/i)) result.efficiency_rating = 'Gold';
                else if (val.match(/platinum/i)) result.efficiency_rating = 'Platinum';
                else if (val.match(/titanium/i)) result.efficiency_rating = 'Titanium';
            }
            if (key.match(/modul/)) {
                if (val.match(/non/i)) result.modular = 'Non';
                else if (val.match(/semi/i)) result.modular = 'Semi';
                else if (val.match(/oui|full|100%/i)) result.modular = 'Full';
            }
        }
        else if (category === 'case') {
            if (key.match(/longueur max gpu|gpu.*length|carte graphique/i)) result.max_gpu_length_mm = parseInt(val.match(/(\d{3})/)?.[1] || '0');
            if (key.match(/hauteur max|cooler.*height|ventirad/i)) result.max_cooler_height_mm = parseInt(val.match(/(\d{3})/)?.[1] || '0');
        }
    }
    
    // Clean zeros
    return Object.fromEntries(Object.entries(result).filter(([_, v]) => v !== 0 && v !== null && (!Array.isArray(v) || v.length > 0)));
}

async function deepBackfill() {
    console.log('🚀 Starting Comprehensive Deep Spec Backfill from Retailers...\n');

    const rows = await sql`
        SELECT c.id, c.name, c.category, p.product_url 
        FROM components c
        JOIN prices p ON p.component_id = c.id
        WHERE c.is_active = true
          AND (
            (c.category = 'ram' AND c.cas_latency IS NULL) OR
            (c.category = 'cpu' AND (c.core_count IS NULL OR c.tdp IS NULL OR c.base_clock_ghz IS NULL)) OR
            (c.category = 'gpu' AND (c.length_mm IS NULL OR c.vram_gb IS NULL)) OR
            (c.category = 'motherboard' AND (c.socket IS NULL OR c.form_factor IS NULL)) OR
            (c.category = 'storage' AND (c.read_speed_mbps IS NULL OR c.capacity_gb IS NULL)) OR
            (c.category = 'cooling' AND (c.max_tdp IS NULL OR c.noise_db IS NULL)) OR
            (c.category = 'case' AND (c.max_gpu_length_mm IS NULL OR c.max_cooler_height_mm IS NULL)) OR
            (c.category = 'psu' AND (c.wattage IS NULL OR c.efficiency_rating IS NULL)) OR
            (c.category = 'fan' AND (c.size_mm IS NULL OR c.noise_db IS NULL))
          )
        ORDER BY c.id DESC
    ` as { id: number; name: string; category: string; product_url: string }[];

    console.log(`Analyzing ${rows.length} components...\n`);
    let updated = 0;

    for (const row of rows) {
        queue.add(async () => {
            const domain = new URL(row.product_url).hostname.replace('www.', '');

            try {
                // Native Bun fetch with strict 4s timeout
                const res = await fetch(row.product_url, { 
                    signal: AbortSignal.timeout(4000)
                });
                
                if (!res.ok) {
                    return;
                }
                const html = await res.text();
                const $ = cheerio.load(html);
                
                const rawSpecs = extractSpecsGeneric($);
                const cleanSpecs = mapSpecs(rawSpecs, row.category, row.name);

                if (Object.keys(cleanSpecs).length > 0) {
                    console.log(`    ✅ [${domain}] [${row.category}] ${row.name} →`, cleanSpecs);
                    
                    const keys = Object.keys(cleanSpecs);
                    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`);
                    const values = keys.map(k => cleanSpecs[k]);

                    await sql.unsafe(`
                        UPDATE components 
                        SET ${setClauses.join(', ')},
                            updated_at = NOW()
                        WHERE id = $1
                    `, [row.id, ...values]);
                    
                    updated++;
                }
            } catch (err) {
                // silent
            }
        });
    }

    await queue.onIdle();
    console.log(`\n🎉 Comprehensive backfill complete. Updated ${updated} components.`);
}

await deepBackfill();
process.exit(0);