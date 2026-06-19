import { SQL } from 'bun';

const sql = new SQL(process.env.DATABASE_URL!);

async function checkBadMappings() {
  const mappings = await sql`
    SELECT sm.product_url, c.name, c.id
    FROM scraper_mappings sm
    JOIN components c ON sm.component_id = c.id
    WHERE c.category = 'cpu'
  `;

  let badCount = 0;
  
  for (const m of mappings) {
    const slug = m.product_url.toLowerCase();
    
    // Core i5 13400F -> check if "13400f" is in the url exactly as a word, or "13400-f"
    // Extract the exact model identifier from the component name using regex
    const match = m.name.match(/\b(\d{3,4}[a-zA-Z]*)\b/i);
    
    if (match) {
      const modelNum = match[1].toLowerCase();
      // Look for the exact model number in the slug, bordered by non-alphanumeric chars or end of string
      const regex = new RegExp(`(?<=[^a-z0-9]|^)${modelNum}(?=[^a-z0-9]|$)`, 'i');
      
      if (!regex.test(slug)) {
        console.log(`[MISMATCH] Component: ${m.name} | URL: ${m.product_url}`);
        badCount++;
      }
    }
  }
  
  console.log(`\nFound ${badCount} blatant URL mismatches.`);
  process.exit(0);
}

checkBadMappings().catch(console.error);
