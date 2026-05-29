import { sql } from 'bun';
import { extractCoolingSpecs } from '@shared/hardware/specs/cooling';

function norm(s: string) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }

async function backfillCaseClearance() {
    const rows = await sql`SELECT id, name, form_factor FROM components WHERE category = 'case' AND max_cooler_height_mm IS NULL` as { id: number; name: string; form_factor: string | null }[];
    let updated = 0;
    
    // Generic defaults based on form factor if specific model unknown
    const caseLimits: Record<string, number> = {
        'h5 flow': 165,
        'h7 flow': 185,
        'h9 flow': 165,
        '4000d': 170,
        '5000d': 170,
        '7000d': 190,
        'o11 dynamic': 155,
        'o11d evo': 167,
        'pop air': 170,
        'meshify 2': 185,
        'north': 170,
        'lancool 216': 180,
        'lancool iii': 187,
        'tuf gaming gt502': 163,
        'tuf gaming gt301': 160,
        'mag forge 100': 160,
        'mag forge m100': 160,
        'ck560': 175,
        'ch560': 175,
        'mac-s2': 145,
    };

    for (const { id, name, form_factor } of rows) {
        const n = norm(name);
        let limit: number | null = null;
        
        for (const [key, l] of Object.entries(caseLimits)) {
            if (n.includes(key)) {
                limit = l;
                break;
            }
        }
        
        if (limit) {
            await sql`UPDATE components SET max_cooler_height_mm = ${limit} WHERE id = ${id}`;
            updated++;
        }
    }
    console.log(`Case Clearance: ${updated}/${rows.length} updated`);
}

async function backfillCoolingSpecs() {
    // 1. Move misclassified case fans from Cooling to Fan category
    console.log('🔄 Moving misclassified case fans from Cooling to Fan category...');
    const fansMoved = await sql`
        UPDATE components 
        SET category = 'fan',
            updated_at = NOW()
        WHERE category = 'cooling' 
          AND (name ILIKE '%wings%' OR name ILIKE '%3-pack%' OR name ILIKE '%triple pack%' OR name ILIKE '%pack de%' OR name ILIKE '%pack of%' OR name ILIKE '%pure%wings%')
    `;
    console.log(`✅ Moved ${fansMoved.count ?? 0} case fans to Fan category.`);

    // 2. Target reset of all active cooling specs first to ensure clean idempotent run
    console.log('🔄 Resetting cooling heuristics for a fresh accurate pass...');
    await sql`
        UPDATE components 
        SET height_mm = NULL, 
            max_tdp = NULL, 
            tags = NULL,
            supported_sockets = NULL 
        WHERE category = 'cooling' AND is_active = true
    `;

    const rows = await sql`
        SELECT id, name, brand, tags, height_mm, max_tdp, supported_sockets 
        FROM components 
        WHERE category = 'cooling' AND is_active = true
    ` as { 
        id: number; 
        name: string; 
        brand: string | null; 
        tags: string[] | null; 
        height_mm: number | null; 
        max_tdp: number | null; 
        supported_sockets: string[] | null;
    }[];
    
    let updated = 0;
    
    // Most popular coolers exact heights lookup
    const heightsDict: Record<string, number> = {
        'nh-d15': 165,
        'nh-u12s': 158,
        'nh-l9i': 37,
        'nh-l9a': 37,
        'pure rock 2': 155,
        'dark rock pro 4': 163,
        'dark rock 4': 159,
        'hyper 212': 159,
        'ak620': 160,
        'ak400': 155,
        'ag620': 160,
        'ag400': 150,
        'assassin iii': 165,
        'peerless assassin 120': 157,
        'phantom spirit 120': 154,
        'wraith prism': 92,
        'wraith stealth': 54,
        'wraith spire': 71,
        't120': 159,
        'h212': 159,
        'g200p': 39,
        'i70c': 60,
        'arctic frost': 65,
        'boreas e1-410': 154,
        'wraith ripper': 160,
    };

    // Modern common sockets list includes LGA1851 (Intel Arrow Lake / Core Ultra)
    const commonSockets = ['LGA1851', 'LGA1700', 'LGA1200', 'LGA1151', 'AM4', 'AM5'];

    for (const row of rows) {
        const specs = extractCoolingSpecs(row.name, row.brand ?? undefined);
        
        let height = row.height_mm;
        let tdp = row.max_tdp;
        let sockets = row.supported_sockets;
        let needsUpdate = false;
        
        // 1. Sockets
        if (!sockets || sockets.length === 0) {
            sockets = [...commonSockets];
            const n = norm(`${row.brand ?? ''} ${row.name}`);
            if (/\b(tr4|threadripper)\b/i.test(n)) {
                sockets.push('TR4', 'sTRX4');
            }
            needsUpdate = true;
        }

        // 2. Height
        if (height === null) {
            height = specs.height_mm;
            needsUpdate = true;
        }

        // 3. TDP
        if (tdp === null) {
            tdp = specs.tdp;
            needsUpdate = true;
        }
        
        // 4. Tags (like 'aio', radiator sizes, or 'accessory')
        const tagsToUpdate = specs.tags;
        needsUpdate = true;

        if (needsUpdate) {
            const pgSockets = '{' + sockets.map(s => `"${s}"`).join(',') + '}';
            const pgTags = tagsToUpdate.length > 0 ? '{' + tagsToUpdate.map(t => `"${t.replace(/"/g, '\\"')}"`).join(',') + '}' : null;
            await sql`
                UPDATE components 
                SET height_mm = ${height},
                    max_tdp = ${tdp},
                    tags = ${pgTags ? sql`${pgTags}::text[]` : null},
                    supported_sockets = ${pgSockets}::text[],
                    updated_at = NOW()
                WHERE id = ${row.id}
            `;
            updated++;
        }
    }
    console.log(`Cooling Specifications: ${updated}/${rows.length} updated`);
}

console.log('Starting dimension backfill...\n');
await backfillCaseClearance();
await backfillCoolingSpecs();
console.log('\nDimension backfill complete.');
process.exit(0);
