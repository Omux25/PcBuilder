
import { getSql } from '../core/db/index.js';
// Using relative path to ensure we get the latest changes during remediation
import { inferCategory } from '../../../../shared/hardware/categories.js';

async function remediateCategories() {
  const sql = getSql();
  console.log('--- STARTING CATEGORY REMEDIATION ---');

  // Core categories that are often polluted
  const components = await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE category IN ('case', 'storage', 'fan', 'cooling', 'psu')
  ` as any[];

  let moved = 0;
  for (const c of components) {
    const mappings = await sql`SELECT product_identifier FROM scraper_mappings WHERE component_id = ${c.id}`;
    const identifiers = mappings.map(m => m.product_identifier);
    
    const namesToTest = [c.name, `${c.brand} ${c.name}`, ...identifiers];
    let newCategory: string | null = null;
    
    for (const testName of namesToTest) {
      if (!testName) continue;
      const suggested = inferCategory(testName);
      if (suggested && suggested !== c.category) {
        // Special mapping for 'build' -> 'accessory' to satisfy DB constraints
        newCategory = (suggested as string) === 'build' ? 'accessory' : (suggested as string);
        break; 
      }
    }

    if (newCategory && newCategory !== c.category) {
      // Final guard against 'bundle' or other non-existent categories
      const VALID_CATEGORIES = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case', 'cooling', 'fan', 'thermal_paste', 'monitor', 'keyboard', 'mouse', 'headphones', 'speakers', 'webcam', 'os', 'wired_network_adapter', 'wireless_network_adapter', 'sound_card', 'case_accessory', 'fan_controller', 'external_storage', 'optical_drive', 'ups', 'accessory'];
      
      if (!VALID_CATEGORIES.includes(newCategory)) {
        newCategory = 'accessory';
      }

      console.log(`[MOVE] ID ${c.id}: "${c.brand} ${c.name}" | ${c.category} -> ${newCategory}`);
      try {
        await sql`UPDATE components SET category = ${newCategory}, updated_at = NOW() WHERE id = ${c.id}`;
        moved++;
      } catch (err) {
        console.error(`  [ERROR] Failed to move ID ${c.id} to ${newCategory}: ${err.message}`);
      }
    }
  }

  console.log(`\nRemediation complete. Moved ${moved} components.`);
}

remediateCategories().catch(console.error);
