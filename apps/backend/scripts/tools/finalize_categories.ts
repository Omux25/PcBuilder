import { sql } from 'bun';

async function finalCategorization() {
    console.log('🏁 Final category alignment...\n');

    // 1. Move bundles currently in PSU to Case
    const bundlesInPsu = await sql`SELECT id, name FROM components WHERE category = 'psu' AND name ~* '\\\\+' AND name ~* 'boitier|tower|tour|shadow|glass'`;
    if (bundlesInPsu.length > 0) {
        console.log(`📦 Moving ${bundlesInPsu.length} bundles from PSU to Case...`);
        await sql`UPDATE components SET category = 'case' WHERE id IN ${sql(bundlesInPsu.map(r => r.id))}`;
    }

    // 2. Double check if any real cases are left in cooling (e.g. searching for 'window' or 'chassis' in cooling)
    const casesInCooling = await sql`SELECT id, name FROM components WHERE category = 'cooling' AND name ~* 'boitier|chassis|window' AND name !~* 'water|liquid|cooler'`;
    if (casesInCooling.length > 0) {
        console.log(`📦 Moving ${casesInCooling.length} missed cases from Cooling to Case...`);
        await sql`UPDATE components SET category = 'case' WHERE id IN ${sql(casesInCooling.map(r => r.id))}`;
    }

    console.log('✅ Final alignment complete.');
}

await finalCategorization();
process.exit(0);
