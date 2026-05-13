import { sql } from 'bun';

console.log('--- Connectivity & Stock Audit ---\n');

const stats = await sql`
    SELECT 
        category,
        COUNT(*) as total_active,
        COUNT(CASE WHEN EXISTS (SELECT 1 FROM prices p WHERE p.component_id = components.id) THEN 1 END) as with_any_price,
        COUNT(CASE WHEN EXISTS (SELECT 1 FROM prices p WHERE p.component_id = components.id AND p.in_stock = true) THEN 1 END) as in_stock_now
    FROM components
    WHERE is_active = true
    GROUP BY category
    ORDER BY total_active DESC
`;

console.table(stats);

const unmatched = await sql`
    SELECT 
        COALESCE(suggestion_category, 'unknown') as cat,
        COUNT(*) as count
    FROM unmatched_listings
    LEFT JOIN unmatched_suggestions ON unmatched_suggestions.unmatched_listing_id = unmatched_listings.id
    WHERE status = 'pending'
    GROUP BY cat
    ORDER BY count DESC
`;

console.log('\n--- Unmatched Listings (Pending) ---');
console.table(unmatched);

const cpuSamples = await sql`
    SELECT scraped_name, product_url 
    FROM unmatched_listings 
    WHERE status = 'pending' 
      AND (scraped_name ~* 'ryzen' OR scraped_name ~* 'intel' OR scraped_name ~* 'core i')
    LIMIT 20
`;

console.log('\n--- Sample Unmatched CPUs ---');
console.table(cpuSamples);
