import { SQL } from 'bun';

const sql = new SQL(process.env.DATABASE_URL!);

async function checkCPUs() {
  console.log('Checking CPU data for anomalies...\n');

  // Find CPUs with unusually high price variance or other anomalies
  const anomalies = await sql`
    WITH PriceStats AS (
      SELECT 
        c.id,
        c.name,
        c.brand,
        c.category,
        c.specs,
        COUNT(p.id) as num_prices,
        MIN(p.price) as min_price,
        MAX(p.price) as max_price,
        AVG(p.price) as avg_price,
        (MAX(p.price) / NULLIF(MIN(p.price), 0)) as price_ratio
      FROM components c
      LEFT JOIN prices p ON c.id = p.component_id
      WHERE c.category = 'cpu'
      GROUP BY c.id, c.name, c.brand, c.category, c.specs
    )
    SELECT * 
    FROM PriceStats 
    WHERE num_prices > 0 
      AND (price_ratio > 1.5 OR min_price < 500) -- Flag if max is 50% more than min, or if min is suspiciously low
    ORDER BY price_ratio DESC;
  `;

  if (anomalies.length === 0) {
    console.log('No major price variance anomalies found for CPUs.');
  } else {
    console.log(`Found ${anomalies.length} CPUs with potential price mapping issues (Price Ratio > 1.5 or Min Price < 500):\n`);
    for (const cpu of anomalies) {
      console.log(`[ID: ${cpu.id}] ${cpu.brand} ${cpu.name}`);
      console.log(`  Prices: Min ${cpu.min_price} MAD | Max ${cpu.max_price} MAD | Ratio: ${Number(cpu.price_ratio).toFixed(2)}x`);
      
      const mappings = await sql`
        SELECT p.product_url, p.price, r.name as retailer
        FROM prices p
        JOIN retailers r ON p.retailer_id = r.id
        WHERE p.component_id = ${cpu.id}
        ORDER BY p.price ASC
      `;
      
      for (const m of mappings) {
        console.log(`    - ${m.price} MAD | [${m.retailer}]`);
        console.log(`      URL: ${m.product_url}`);
      }
      console.log();
    }
  }

  // Also check for missing or malformed specs
  const badSpecs = await sql`
    SELECT id, name, specs 
    FROM components 
    WHERE category = 'cpu' 
      AND (specs IS NULL OR specs->>'cores' IS NULL OR specs->>'base_clock' IS NULL)
  `;
  
  if (badSpecs.length > 0) {
    console.log(`Found ${badSpecs.length} CPUs with missing/incomplete specs:\n`);
    for (const cpu of badSpecs) {
      console.log(`[ID: ${cpu.id}] ${cpu.name} | Specs: ${JSON.stringify(cpu.specs)}`);
    }
  }

  process.exit(0);
}

checkCPUs().catch(err => {
  console.error(err);
  process.exit(1);
});
