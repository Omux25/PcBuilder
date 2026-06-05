import type { SqlFn } from '../../../../core/db/index.js';
import type { TaskResult } from '../curationEngine.js';
import { inferCategory } from '@shared/hardware/categories';

export async function remediateCategories(sql: SqlFn): Promise<TaskResult> {
  const components = await sql`
    SELECT id, name, brand, category
    FROM components
  ` as any[];

  let moved = 0;
  for (const c of components) {
    const mappings = (await sql`SELECT product_identifier FROM scraper_mappings WHERE component_id = ${c.id}`) as { product_identifier: string }[];
    const identifiers = mappings.map((m: any) => m.product_identifier);
    
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

      await sql`UPDATE components SET category = ${newCategory}, updated_at = NOW() WHERE id = ${c.id}`;
      moved++;
    }
  }

  return {
    success: true,
    mutatedCount: moved,
    message: `Reclassified ${moved} component(s) based on weighted name voting.`
  };
}
