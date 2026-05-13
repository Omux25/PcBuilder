import { sql } from 'bun';

/**
 * Normalizes component names by stripping technical specifications and redundant brands.
 * This effectively turns the 'name' column into a pure 'model' column.
 */

async function normalizeAll() {
    console.log('🚀 Starting Database Name Normalization (extracting models)...\n');

    const components = await sql`
        SELECT id, name, brand, category 
        FROM components 
        WHERE is_active = true
    ` as { id: number; name: string; brand: string | null; category: string }[];

    let updated = 0;
    const samples: string[] = [];

    for (const c of components) {
        let model = c.name;
        const original = c.name;

        // 1. Remove Brand if it's at the start
        if (c.brand && model.toLowerCase().startsWith(c.brand.toLowerCase())) {
            model = model.slice(c.brand.length).trim();
        }

        // 2. Generic Technical Noise Removal (case-insensitive)
        // Patterns to match: "32GB", "16 GB", "6000MHz", "CL16", "850W", "80+ Gold", etc.
        const patterns = [
            /\b\d+\s*gb\b/i,
            /\b\d+\s*tb\b/i,
            /\b\d+x\d+\s*gb\b/i,
            /\b\d+\s*mhz\b/i,
            /\bcl\s*\d{2}\b/i,
            /\b\d{3,4}\s*w\b/i,
            /\b80\+\s*(gold|platinum|titanium|bronze|silver|white)\b/i,
            /\b(ddr4|ddr5)\b/i,
            /\b(nvme|sata|hdd|ssd)\b/i,
            /\b(atx|matx|itx|eatx|mini-itx|micro-atx)\b/i,
            /\b\d+mm\b/i,
            /\bpack\s*of\s*\d+\b/i,
            /\b(non|full|semi)\s*modular\b/i,
            /\(.*\)/g, // Remove parentheses entirely (often contains redundant specs)
        ];

        for (const p of patterns) {
            model = model.replace(p, '').trim();
        }

        // 3. Clean up extra spaces and punctuation
        model = model.replace(/\s+/g, ' ').replace(/^[-/]|[-/]$/g, '').trim();

        if (model !== original && model.length > 2) {
            if (samples.length < 20) {
                samples.push(`  [${c.category}] "${original}" -> "${model}"`);
            }
            await sql`UPDATE components SET name = ${model} WHERE id = ${c.id}`;
            updated++;
        }
    }

    console.log('Sample Updates:');
    console.log(samples.join('\n'));

    console.log(`\n✅ Normalization complete. ${updated} components updated.`);
}

await normalizeAll();
process.exit(0);
