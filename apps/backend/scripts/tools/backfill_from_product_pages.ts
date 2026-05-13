import { sql } from 'bun';
import * as cheerio from 'cheerio';
import PQueue from 'p-queue';

const queue = new PQueue({ concurrency: 3 });

const RETAILER_PARSERS: Record<string, (html: string, category: string) => Record<string, any>> = {
    'ultrapc.ma': (html, category) => {
        const $ = cheerio.load(html);
        const dataAttr = $('#product-details').attr('data-product');
        if (!dataAttr) return {};
        const productData = JSON.parse(dataAttr);
        const features = productData.features || [];
        const result: Record<string, any> = {};

        for (const feat of features) {
            const name = feat.name.toLowerCase();
            const val = feat.value;
            if (category === 'storage') {
                if (name.includes('lecture') || name.includes('read')) result.read_speed_mbps = parseInt(val.match(/(\d+)/)?.[1] || '0');
                if (name.includes('ecriture') || name.includes('write')) result.write_speed_mbps = parseInt(val.match(/(\d+)/)?.[1] || '0');
            }
            if (category === 'cooling' || category === 'fan') {
                if (name.includes('hauteur') || name.includes('height')) result.height_mm = parseInt(val.match(/(\d+)/)?.[1] || '0');
                if (name.includes('bruit') || name.includes('noise')) result.noise_db = parseFloat(val.match(/(\d+\.?\d*)/)?.[1] || '0');
                if (name.includes('flux') || name.includes('airflow')) result.airflow_cfm = parseFloat(val.match(/(\d+\.?\d*)/)?.[1] || '0');
            }
        }
        return result;
    },
    'pcgamer.ma': (html, category) => {
        const $ = cheerio.load(html);
        const result: Record<string, any> = {};
        $('.product-features dt, .product-features dd').each((i, el) => {
           // similar logic to ultrapc if it uses standard prestashop
        });
        return result;
    }
};

async function deepBackfill() {
    console.log('🚀 Starting Universal Deep Backfill...\n');

    const rows = await sql`
        SELECT c.id, c.name, c.category, p.product_url 
        FROM components c
        JOIN prices p ON p.component_id = c.id
        WHERE c.is_active = true
          AND (
            (c.category = 'storage' AND c.read_speed_mbps IS NULL) OR
            (c.category = 'cooling' AND c.height_mm IS NULL) OR
            (c.category = 'fan' AND c.airflow_cfm IS NULL)
          )
        LIMIT 200
    ` as { id: number; name: string; category: string; product_url: string }[];

    console.log(`Analyzing ${rows.length} components...\n`);

    for (const row of rows) {
        queue.add(async () => {
            const domain = new URL(row.product_url).hostname.replace('www.', '');
            const parser = RETAILER_PARSERS[domain];
            
            if (!parser) return;

            try {
                const res = await fetch(row.product_url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                if (!res.ok) return;
                const html = await res.text();
                const specs = parser(html, row.category);

                const cleanSpecs = Object.fromEntries(Object.entries(specs).filter(([_, v]) => v && v > 0));

                if (Object.keys(cleanSpecs).length > 0) {
                    console.log(`    ✅ [${domain}] Found specs for ${row.name}:`, cleanSpecs);
                    await sql.unsafe(`
                        UPDATE components 
                        SET ${Object.entries(cleanSpecs).map(([k, v]) => `${k} = ${v}`).join(', ')},
                            updated_at = NOW()
                        WHERE id = $1
                    `, [row.id]);
                }
            } catch (err) {
                // silent
            }
        });
    }

    await queue.onIdle();
    console.log('\nUniversal deep backfill complete.');
}

await deepBackfill();
process.exit(0);
