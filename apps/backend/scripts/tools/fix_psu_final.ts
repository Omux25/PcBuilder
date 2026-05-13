import { sql } from 'bun';

async function fixPsuCorruption() {
    console.log('🧹 Correcting PSU Spec Errors & Cleaning Names...\n');

    // 1. Fix Specific MSI MAG N-H Mis-matches
    await sql`UPDATE components SET wattage = 300, efficiency_rating = '80+' WHERE id = 3811`; // A300N-H
    await sql`UPDATE components SET wattage = 500, efficiency_rating = '80+' WHERE id = 3565`; // A500N-H
    console.log('✅ Corrected MSI MAG A300/A500 specs.');

    // 2. Aggressive PSU Name Normalization
    // We need to strip "80 Plus", "Gold", "Bronze", "Wattage", "PSU" from the NAME column
    // since they are now structured fields and we don't want them showing twice.
    const psus = await sql`SELECT id, name, brand FROM components WHERE category = 'psu'` as { id: number; name: string; brand: string | null }[];
    
    let updated = 0;
    for (const p of psus) {
        let model = p.name;
        
        // Remove redundant brand at start
        if (p.brand && model.toLowerCase().startsWith(p.brand.toLowerCase())) {
            model = model.slice(p.brand.length).trim();
        }

        const redundantPatterns = [
            /\b\d+\s*w\b/gi,
            /\b80\s*plus\b/gi,
            /\b80\+\b/gi,
            /\bgold\b/gi,
            /\bbronze\b/gi,
            /\bplatinum\b/gi,
            /\btitanium\b/gi,
            /\bsilver\b/gi,
            /\bpsu\b/gi,
            /\balimentation\b/gi,
            /\bmodulaire\b/gi,
            /\bmodular\b/gi,
            /\bsemi\b/gi,
            /\bfull\b/gi,
            /\bpc\s*core\b/gi,
            /–/g, // dashes
            /-/g,
        ];

        for (const pattern of redundantPatterns) {
            model = model.replace(pattern, '').trim();
        }

        // Clean up remaining junk
        model = model.replace(/\s+/g, ' ').replace(/^[-/]|[-/]$/g, '').trim();

        if (model !== p.name && model.length > 1) {
            await sql`UPDATE components SET name = ${model} WHERE id = ${p.id}`;
            updated++;
        }
    }
    console.log(`✅ Normalized ${updated} PSU model names.`);
}

await fixPsuCorruption();
process.exit(0);
