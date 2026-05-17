import { sql } from 'bun';

async function finalCleanup() {
    // 1. Move the specific ones we know are cases/bundles
    const toCase = [3933, 3932, 4312]; 
    // 4312 is "Connect Bolt ARGB + PSU 550W"
    
    await sql`UPDATE components SET category = 'case' WHERE id IN ${sql(toCase)}`;

    // 2. Search for common cooler brands/names in PSU
    const toCooling = await sql`
        SELECT id, name FROM components 
        WHERE category = 'psu' 
          AND (name ~* 'freezer|liquid|aqua|assassin|spirit|ak400|ak620|t120|wraith')
    `;
    if (toCooling.length > 0) {
        await sql`UPDATE components SET category = 'cooling' WHERE id IN ${sql(toCooling.map((r: any) => r.id))}`;
    }

    // 3. One more for "Nova Glacial" (Arctic/Nova)
    await sql`UPDATE components SET category = 'cooling' WHERE category = 'psu' AND name ~* 'nova|glacial'`;

    console.log('Final surgical cleanup done.');
}

await finalCleanup();
process.exit(0);
