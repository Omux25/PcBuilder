import { sql } from 'bun';

async function deepAudit() {
    console.log('🧪 Starting High-Precision Category Audit...\n');

    // 1. Identify "Cooler" noise in Case/PSU names
    const noise = await sql`SELECT id, name, category FROM components WHERE (category = 'case' OR category = 'psu') AND name ~* 'Cooler'`;
    if (noise.length > 0) {
        console.log(`🧹 Found ${noise.length} cases/psus with "Cooler" appended to name (Scraper noise).`);
        for (const item of noise) {
            const cleanName = item.name.replace(/\s*[cC]ooler\b/g, '').trim();
            await sql`UPDATE components SET name = ${cleanName} WHERE id = ${item.id}`;
        }
        console.log('✅ Cleaned component names.');
    }

    // 2. RAM in PSU category (Very common error)
    const ramInPsu = await sql`SELECT id, name FROM components WHERE category = 'psu' AND name ~* 'DDR[45]|RAM|Mémoire'`;
    if (ramInPsu.length > 0) {
        console.log(`⚠️  Moving ${ramInPsu.length} RAM modules found in PSU category...`);
        await sql`UPDATE components SET category = 'ram' WHERE id IN ${sql(ramInPsu.map(r => r.id))}`;
    }

    // 3. PSUs in Cooling (Common)
    const psuInCooling = await sql`SELECT id, name FROM components WHERE category = 'cooling' AND name ~* 'Gold|Platinum|Bronze|Modular|[56789]00W'`;
    if (psuInCooling.length > 0) {
        console.log(`⚠️  Moving ${psuInCooling.length} PSUs found in Cooling category...`);
        await sql`UPDATE components SET category = 'psu' WHERE id IN ${sql(psuInCooling.map(r => r.id))}`;
    }

    // 4. Fans in Cooling (Kits vs single fans)
    // If it's a pack of fans, it should be in 'fan' category
    const packsInCooling = await sql`SELECT id, name FROM components WHERE category = 'cooling' AND name ~* 'Pack of|Pack de|3-Pack|2-Pack'`;
    if (packsInCooling.length > 0) {
        console.log(`⚠️  Moving ${packsInCooling.length} fan packs found in Cooling to Fan category...`);
        await sql`UPDATE components SET category = 'fan' WHERE id IN ${sql(packsInCooling.map(r => r.id))}`;
    }

    // 5. Final Report of suspicious items that need manual check
    const suspicious = await sql`
        SELECT id, name, category FROM components 
        WHERE (category = 'cpu' AND name ~* 'clavier|souris|tapis')
           OR (category = 'gpu' AND name ~* 'boitier|ventilateur')
           OR (category = 'motherboard' AND name ~* 'disque|ssd')
    `;
    
    if (suspicious.length > 0) {
        console.log('\n🚩 Suspicious items requiring manual review:');
        console.table(suspicious);
    } else {
        console.log('\n✅ No cross-category core hardware anomalies found.');
    }
}

await deepAudit();
process.exit(0);
