import { sql } from 'bun';

async function fixEliteGaps() {
    console.log('🚀 Fixing "Elite" series miscategorization...\n');

    // 1. Move Cooler Master Elite CASES (3xx, 4xx, 5xx, 6xx numbering)
    // IDs identified: 3787, 3788, 3792, 3668, 3693
    const cmCaseIds = [3787, 3788, 3792, 3668, 3693];
    await sql`UPDATE components SET category = 'case' WHERE id IN ${sql(cmCaseIds)}`;
    console.log(`✅ Moved ${cmCaseIds.length} Cooler Master Elite cases.`);

    // 2. M.RED Elite Rainbow ARGB -> This is a case
    await sql`UPDATE components SET category = 'case' WHERE id = 619`;
    console.log(`✅ Moved M.RED Elite Rainbow ARGB to Case.`);

    // 3. Let's do a wider search for any other cases hiding in PSU
    // Specifically looking for model numbers that are known CM cases
    const cmMisc = await sql`
        SELECT id, name FROM components 
        WHERE category = 'psu' 
          AND brand = 'Cooler Master' 
          AND (name ~* '310|311|330|331|332|333|334|335|341|342|343|344|360|361|370|371|372')
    `;
    if (cmMisc.length > 0) {
        console.log(`⚠️  Found ${cmMisc.length} more potential CM cases in PSU category.`);
        await sql`UPDATE components SET category = 'case' WHERE id IN ${sql(cmMisc.map((r: any) => r.id))}`;
    }

    console.log('\n✨ Cleanup complete.');
}

await fixEliteGaps();
process.exit(0);
