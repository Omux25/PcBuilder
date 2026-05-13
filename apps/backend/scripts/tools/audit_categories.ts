import { sql } from 'bun';

async function auditCategories() {
    console.log('🔍 Auditing Database Categories for Anomalies...\n');

    const checks = [
        { 
            label: 'RAM keywords in non-RAM categories',
            query: sql`SELECT id, name, category FROM components WHERE category != 'ram' AND (name ~* 'ram|ddr4|ddr5|mémoire|veng|trident|flare|ripjaws')` 
        },
        { 
            label: 'Storage keywords in non-Storage categories',
            query: sql`SELECT id, name, category FROM components WHERE category NOT IN ('storage', 'external_storage') AND (name ~* 'ssd|hdd|disque|nvme|sata')` 
        },
        { 
            label: 'Cooling keywords in non-Cooling categories',
            query: sql`SELECT id, name, category FROM components WHERE category NOT IN ('cooling', 'fan') AND (name ~* 'liquid|water|cooler|ventirad|arctic|be quiet')` 
        },
        { 
            label: 'Monitor keywords in non-Monitor categories',
            query: sql`SELECT id, name, category FROM components WHERE category != 'monitor' AND (name ~* 'écran|moniteur|display|hz|ips|va|curved')` 
        },
        { 
            label: 'Case keywords in non-Case categories',
            query: sql`SELECT id, name, category FROM components WHERE category != 'case' AND (name ~* 'boitier|chassis|atx|matx|itx') AND category NOT IN ('motherboard', 'psu')` 
        }
    ];

    for (const check of checks) {
        const rows = await check.query;
        if (rows.length > 0) {
            console.log(`⚠️  ${check.label} (${rows.length} found):`);
            console.table(rows.slice(0, 10)); // Show top 10
        } else {
            console.log(`✅ ${check.label}: None found.`);
        }
        console.log('');
    }
}

await auditCategories();
process.exit(0);
