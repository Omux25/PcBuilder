
import { getSql } from '../core/db/index.js';

async function remediate() {
  const sql = getSql();
  console.log('--- REMEDIATING NOX HUMMER DISCREPANCY ---');

  await sql.begin(async (tx) => {
    // 1. Fix the miscategorized component
    console.log('Moving component 374 to "cooling" category...');
    await tx`
      UPDATE components 
      SET category = 'cooling', 
          name = 'Hummer H-112',
          brand = 'Nox'
      WHERE id = 374
    `;

    // 2. Identify and remove the incorrect price mapping
    // This price is for TGM ARGB (a case) but was matched to H-112 (a cooler)
    console.log('Removing incorrect price mapping (TGM ARGB -> H-112)...');
    
    // Delete the price history first if needed (cascade might handle it, but let's be explicit)
    await tx`DELETE FROM price_history WHERE component_id = 374 AND price = 799.00`;
    
    // Delete the price entry
    await tx`DELETE FROM prices WHERE component_id = 374 AND product_url ILIKE '%nox-hummer-tgm-argb%'`;

    // Delete the scraper mapping so it can be re-mapped correctly later
    await tx`DELETE FROM scraper_mappings WHERE component_id = 374 AND product_url ILIKE '%nox-hummer-tgm-argb%'`;

    console.log('Database cleaned. The next scrape will correctly identify TGM ARGB as a case and create a new component for it.');
  });

  console.log('--- REMEDIATION COMPLETE ---');
}

remediate().catch(console.error);
