import { SQL } from 'bun';
import { writeFileSync } from 'fs';

const sql = new SQL(process.env.DATABASE_URL!);

async function run() {
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
      AND price_ratio > 1.5
    ORDER BY price_ratio DESC;
  `;

  let md = '# CPU Data Quality Analysis\n\n';
  md += 'This report highlights data quality issues found in the scraped CPU data.\n\n';

  md += '## Extreme Price Variations\n';
  md += 'These CPUs have a massive discrepancy between their lowest and highest scraped prices (Max Price > 1.5x Min Price), which usually indicates a scraper mapping error.\n\n';

  for (const cpu of anomalies) {
    md += `### [ID: ${cpu.id}] ${cpu.brand} ${cpu.name}\n`;
    md += `**Min Price:** ${cpu.min_price} MAD | **Max Price:** ${cpu.max_price} MAD | **Ratio:** ${Number(cpu.price_ratio).toFixed(2)}x\n\n`;
    
    const mappings = await sql`
      SELECT sm.product_url, p.price, r.name as retailer
      FROM prices p
      JOIN retailers r ON p.retailer_id = r.id
      JOIN scraper_mappings sm ON sm.component_id = p.component_id AND sm.retailer_id = p.retailer_id
      WHERE p.component_id = ${cpu.id}
      ORDER BY p.price ASC
    `;
    
    for (const m of mappings) {
      md += `- **${m.price} MAD** [${m.retailer}]: \n  \`${m.product_url}\`\n`;
    }
    md += '\n';
  }

  // Find explicit URL mismatches
  md += '## Blatant URL Mismatches\n';
  md += 'These are mappings where the product URL clearly contains a different CPU model number than the component it is mapped to.\n\n';

  const allMappings = await sql`
    SELECT sm.product_url, c.name, c.id, r.name as retailer
    FROM scraper_mappings sm
    JOIN components c ON sm.component_id = c.id
    JOIN retailers r ON sm.retailer_id = r.id
    WHERE c.category = 'cpu'
  `;

  for (const m of allMappings) {
    const slug = m.product_url.toLowerCase();
    
    // Extract the main model number (e.g. 13400F, 7800X3D, 7600)
    // Matches 3-5 digits followed by optional letters
    const match = m.name.match(/\b(\d{3,5}[a-zA-Z0-9]*)\b/i);
    
    if (match) {
      let modelNum = match[1].toLowerCase();
      // Look for the exact model number in the slug
      const regex = new RegExp(`(?<=[^a-z0-9]|^)${modelNum}(?=[^a-z0-9]|$)`, 'i');
      
      // Some special cases for normalization
      // For instance if component is 7900 X3D, modelNum will be 7900
      if (m.name.toLowerCase().includes('x3d')) {
         modelNum = modelNum.replace('x', '') + 'x3d';
      }

      if (!slug.includes(modelNum.replace(' ', '')) && !slug.includes(modelNum.replace('-', ''))) {
         // Fallback basic check: does the URL contain the digits at all?
         const digitsOnly = modelNum.replace(/[^0-9]/g, '');
         if (digitsOnly.length >= 3 && !slug.includes(digitsOnly)) {
             md += `- **${m.name}** is mapped to:\n  [${m.retailer}] \`${m.product_url}\`\n`;
         }
      }
    }
  }

  writeFileSync('C:\\Users\\Omux2\\.gemini\\antigravity\\brain\\1dbfa256-d038-44cc-bdfd-c482ef41d91d\\cpu_analysis.md', md);
  console.log('Done writing cpu_analysis.md');
  process.exit(0);
}

run().catch(console.error);
