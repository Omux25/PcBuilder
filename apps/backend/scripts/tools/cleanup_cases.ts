import { sql } from 'bun';

async function cleanupCasePollution() {
    console.log('🧹 Cleaning up Case category pollution...\n');

    // Identify cooling items in Case category
    const coolingInCase = await sql`
        SELECT id, name FROM components 
        WHERE category = 'case' 
          AND (
            name ~* 'ml-|ml\\d+|cpu|refroidisseur|wraith|liquid|watercooler|mcpu|mf-|mfx'
            OR name ~* '\\d{3}ml'
          )
    `;

    if (coolingInCase.length > 0) {
        console.log(`⚠️  Found ${coolingInCase.length} cooling items in Case category. Moving them...`);
        const ids = coolingInCase.map((r: any) => r.id);
        await sql`UPDATE components SET category = 'cooling' WHERE id IN ${sql(ids)}`;
        console.log('✅ Moved to Cooling.');
    }

    // Identify PSU items in Case category (that are not bundles)
    const psusInCase = await sql`
        SELECT id, name FROM components 
        WHERE category = 'case' 
          AND (name ~* 'bronze|gold|platinum|modular')
          AND NOT (name ~* 'boitier|tower|tour|chassis|\\\\+')
    `;
    if (psusInCase.length > 0) {
        console.log(`⚠️  Found ${psusInCase.length} PSU items in Case category. Moving them...`);
        const ids = psusInCase.map((r: any) => r.id);
        await sql`UPDATE components SET category = 'psu' WHERE id IN ${sql(ids)}`;
        console.log('✅ Moved to PSU.');
    }

    console.log('\n✨ Database category integrity restored.');
}

await cleanupCasePollution();
process.exit(0);
