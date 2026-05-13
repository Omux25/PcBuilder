import { sql } from 'bun';

async function aggressiveCleanup() {
    console.log('🧹 Aggressive PSU Category Cleanup...\n');

    // 1. Move anything with "Waterforce", "Liquid", "AIO", "Refroidissement" to cooling
    const coolingInPsu = await sql`
        SELECT id, name FROM components 
        WHERE category = 'psu' 
          AND (name ~* 'waterforce|liquid|aio|refroidissement|cooler|fan|ventilateur')
          AND name !~* '80\\+|watt|gold|bronze|modular' -- safety check to not move actual PSUs with "fan" in name
    `;
    if (coolingInPsu.length > 0) {
        console.log(`❄️ Moving ${coolingInPsu.length} cooling items from PSU to Cooling...`);
        await sql`UPDATE components SET category = 'cooling' WHERE id IN ${sql(coolingInPsu.map(r => r.id))}`;
    }

    // 2. Move anything with "Boitier", "Chassis", "Tower", "Glass" to case
    const casesInPsu = await sql`
        SELECT id, name FROM components 
        WHERE category = 'psu' 
          AND (name ~* 'boitier|chassis|tower|tour|glass|tempered|mesh')
    `;
    if (casesInPsu.length > 0) {
        console.log(`📦 Moving ${casesInPsu.length} cases/bundles from PSU to Case...`);
        await sql`UPDATE components SET category = 'case' WHERE id IN ${sql(casesInPsu.map(r => r.id))}`;
    }
    
    // 3. Specific fix for "Elite" series that are actually cases (repeating for thoroughness)
    const eliteCases = await sql`
        SELECT id, name FROM components 
        WHERE category = 'psu' 
          AND name ~* 'Elite [3456]\\d{2}'
    `;
    if (eliteCases.length > 0) {
        console.log(`📦 Moving ${eliteCases.length} Elite cases to Case category...`);
        await sql`UPDATE components SET category = 'case' WHERE id IN ${sql(eliteCases.map(r => r.id))}`;
    }

    console.log('✅ Aggressive cleanup complete.');
}

await aggressiveCleanup();
process.exit(0);
