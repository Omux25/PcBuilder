import { sql } from 'bun';

async function normalizePsuRatings() {
    console.log('⚡ Standardizing PSU Efficiency Ratings...\n');

    const mapping: Record<string, string> = {
        'Gold': '80+ Gold',
        'Bronze': '80+ Bronze',
        'Platinum': '80+ Platinum',
        'Titanium': '80+ Titanium',
        'Silver': '80+ Silver',
        'White': '80+ White',
        '80+': '80+', // Basic 80 Plus
    };

    let total = 0;
    for (const [oldVal, newVal] of Object.entries(mapping)) {
        const res = await sql`
            UPDATE components 
            SET efficiency_rating = ${newVal} 
            WHERE category = 'psu' 
              AND (efficiency_rating = ${oldVal} OR efficiency_rating = ${oldVal.toLowerCase()})
        `;
        if (res.length > 0 || true) { // sql tag might return rows or info depending on driver
            // we'll just query counts to be sure
        }
    }

    // Handle any missing ones by checking the name
    const missing = await sql`
        SELECT id, name FROM components 
        WHERE category = 'psu' AND (efficiency_rating IS NULL OR efficiency_rating = '')
    `;
    
    for (const item of missing) {
        let found = '';
        const n = item.name.toLowerCase();
        if (n.includes('gold')) found = '80+ Gold';
        else if (n.includes('bronze')) found = '80+ Bronze';
        else if (n.includes('platinum')) found = '80+ Platinum';
        else if (n.includes('titanium')) found = '80+ Titanium';
        else if (n.includes('silver')) found = '80+ Silver';
        
        if (found) {
            await sql`UPDATE components SET efficiency_rating = ${found} WHERE id = ${item.id}`;
            total++;
        }
    }

    console.log('✅ PSU Ratings standardized to "80+ [Metal]" format.');
}

await normalizePsuRatings();
process.exit(0);
