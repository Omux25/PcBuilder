
import { getSql } from '../core/db/index.js';
import { inferCategory } from '../../../../shared/hardware/categories.js';

async function remediateAllCategories() {
  const sql = getSql();
  console.log('--- STARTING COMPREHENSIVE CATEGORY REMEDIATION (WEIGHTED) ---');

  const components = await sql`
    SELECT id, name, brand, category
    FROM components
  ` as any[];

  let moved = 0;
  for (const c of components) {
    const mappings = await sql`SELECT product_identifier FROM scraper_mappings WHERE component_id = ${c.id}`;
    const identifiers = mappings.map(m => m.product_identifier);
    
    // Weighting: Canonical names get 10 votes, identifiers get 1 vote each.
    const allResults: string[] = [];
    
    const canonicalName = c.name;
    const brandName = `${c.brand} ${c.name}`;
    
    const catCanonical = inferCategory(canonicalName);
    if (catCanonical) for (let i = 0; i < 10; i++) allResults.push(catCanonical);
    
    const catBrand = inferCategory(brandName);
    if (catBrand) for (let i = 0; i < 10; i++) allResults.push(catBrand);

    identifiers.forEach(id => {
      const cat = inferCategory(id);
      if (cat) allResults.push(cat);
    });
    
    if (allResults.length === 0) continue;

    const counts: Record<string, number> = {};
    allResults.forEach(s => counts[s] = (counts[s] || 0) + 1);
    
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    let topSuggestion = sorted[0][0];
    let newCategory = topSuggestion === 'build' ? 'accessory' : topSuggestion;

    if (newCategory && newCategory !== c.category) {
      const VALID_CATEGORIES = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case', 'cooling', 'fan', 'thermal_paste', 'monitor', 'keyboard', 'mouse', 'headphones', 'speakers', 'webcam', 'os', 'wired_network_adapter', 'wireless_network_adapter', 'sound_card', 'case_accessory', 'fan_controller', 'external_storage', 'optical_drive', 'ups', 'accessory'];
      
      if (!VALID_CATEGORIES.includes(newCategory)) {
        newCategory = 'accessory';
      }

      console.log(`[MOVE] ID ${c.id}: "${c.brand} ${c.name}" | ${c.category} -> ${newCategory} (Votes: ${counts[topSuggestion]}/${allResults.length})`);
      try {
        await sql`UPDATE components SET category = ${newCategory}, updated_at = NOW() WHERE id = ${c.id}`;
        moved++;
      } catch (err) {
        console.error(`  [ERROR] Failed to move ID ${c.id}: ${err.message}`);
      }
    }
  }

  console.log(`\nRemediation complete. Moved ${moved} components.`);
}

remediateAllCategories().catch(console.error);
