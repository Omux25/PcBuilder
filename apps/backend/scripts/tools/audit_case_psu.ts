import { sql } from 'bun';

async function auditCasePsuOverlap() {
    console.log('🔍 Checking for Case/PSU category confusion...\n');

    // 1. Items in PSU category that look like cases
    const casesInPsu = await sql`
        SELECT id, name, brand FROM components 
        WHERE category = 'psu' 
          AND (name ~* 'boitier|chassis|tower|tour|airflow|tempered|glass|rgb case')
    `;
    if (casesInPsu.length > 0) {
        console.log(`⚠️  Found ${casesInPsu.length} potential cases inside the PSU category:`);
        console.table(casesInPsu);
    } else {
        console.log('✅ No cases found in PSU category.');
    }

    // 2. Items in Case category that look like PSUs (but aren't just "Case + PSU" bundles)
    const psusInCase = await sql`
        SELECT id, name, brand FROM components 
        WHERE category = 'case' 
          AND (name ~* '80\\+|gold|platinum|bronze|modular|watt|[56789]00w')
          AND NOT (name ~* 'boitier|tower|tour|chassis')
    `;
    if (psusInCase.length > 0) {
        console.log(`⚠️  Found ${psusInCase.length} potential PSUs inside the Case category:`);
        console.table(psusInCase);
    } else {
        console.log('✅ No pure PSUs found in Case category.');
    }
}

await auditCasePsuOverlap();
process.exit(0);
