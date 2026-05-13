import { sql } from 'bun';

function norm(s: string) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }

async function backfillCoolerHeights() {
    const rows = await sql`SELECT id, name, brand FROM components WHERE category = 'cooling' AND height_mm IS NULL` as { id: number; name: string; brand: string | null }[];
    let updated = 0;
    
    // Most popular coolers height lookup
    const heights: Record<string, number> = {
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
    };

    for (const { id, name, brand } of rows) {
        const n = norm(name);
        let height: number | null = null;
        
        for (const [key, h] of Object.entries(heights)) {
            if (n.includes(key)) {
                height = h;
                break;
            }
        }
        
        if (height) {
            await sql`UPDATE components SET height_mm = ${height} WHERE id = ${id}`;
            updated++;
        }
    }
    console.log(`Cooler Heights: ${updated}/${rows.length} updated`);
}

async function backfillCaseClearance() {
    const rows = await sql`SELECT id, name, form_factor FROM components WHERE category = 'case' AND max_cooler_height_mm IS NULL` as { id: number; name: string; form_factor: string | null }[];
    let updated = 0;
    
    // Generic defaults based on form factor if specific model unknown
    // ATX Mid Tower usually supports ~160-170mm
    // mATX usually ~150-160mm
    // ITX varies wildly, so we don't default it
    
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
        
        // Fallback generic (safe estimates)
        if (!limit) {
            if (form_factor === 'ATX' || form_factor === 'Full Tower') limit = 160;
            else if (form_factor === 'mATX') limit = 155;
        }
        
        if (limit) {
            await sql`UPDATE components SET max_cooler_height_mm = ${limit} WHERE id = ${id}`;
            updated++;
        }
    }
    console.log(`Case Clearance: ${updated}/${rows.length} updated`);
}

async function backfillCoolingTdp() {
    const rows = await sql`SELECT id, name, tags FROM components WHERE category = 'cooling' AND max_tdp IS NULL` as { id: number; name: string; tags: string[] | null }[];
    let updated = 0;
    
    for (const { id, name, tags } of rows) {
        const n = norm(name);
        let tdp: number | null = null;
        
        const isAio = tags?.includes('aio') || /\baio|liquid|water\b/i.test(n);
        
        if (isAio) {
            if (n.includes('360')) tdp = 300;
            else if (n.includes('240')) tdp = 250;
            else if (n.includes('280')) tdp = 280;
            else if (n.includes('420')) tdp = 350;
            else if (n.includes('120')) tdp = 150;
        } else {
            // Air coolers
            if (n.includes('nh-d15') || n.includes('ak620') || n.includes('assassin iii') || n.includes('peerless assassin')) tdp = 250;
            else if (n.includes('ak400') || n.includes('hyper 212') || n.includes('pure rock')) tdp = 180;
            else if (n.includes('wraith prism')) tdp = 140;
            else if (n.includes('wraith stealth')) tdp = 65;
            else tdp = 120; // safe baseline for tower coolers
        }
        
        if (tdp) {
            await sql`UPDATE components SET max_tdp = ${tdp} WHERE id = ${id}`;
            updated++;
        }
    }
    console.log(`Cooling TDP: ${updated}/${rows.length} updated`);
}

console.log('Starting dimension backfill...\n');
await backfillCoolerHeights();
await backfillCaseClearance();
await backfillCoolingTdp();
console.log('\nDimension backfill complete.');
process.exit(0);
