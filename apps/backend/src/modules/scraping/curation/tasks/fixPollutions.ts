import type { SqlFn } from '../../../../core/db/index.js';
import type { TaskResult } from '../curationEngine.js';
import { extractRamSpecs } from '@shared/hardware/specs/ram';
import { extractStorageSpecs } from '@shared/hardware/specs/storage';
import { extractBrand } from '@shared/hardware/brands';
import { cleanName } from '@shared/hardware/cleaning';
import { generateUniqueSlug } from '@shared/slugify';

export async function fixPollutions(sql: SqlFn): Promise<TaskResult> {
  const candidates = await sql`
    SELECT 
      p.component_id,
      c.name,
      c.brand,
      c.category,
      c.capacity_gb as official_capacity,
      min(p.price) as min_price,
      max(p.price) as max_price,
      count(*) as listing_count
    FROM prices p
    JOIN components c ON c.id = p.component_id
    WHERE c.category IN ('ram', 'storage') AND c.is_active = true
    GROUP BY p.component_id, c.name, c.brand, c.category, c.capacity_gb
    HAVING (max(p.price) / NULLIF(min(p.price), 0)) > 1.6
  ` as { component_id: number; name: string; brand: string; category: string; official_capacity: number | null; min_price: number; max_price: number; listing_count: number }[];

  const existingSlugsRows = await sql`SELECT slug FROM components WHERE slug IS NOT NULL` as { slug: string }[];
  const existingSlugs = new Set(existingSlugsRows.map(r => r.slug));

  let splitComponents = 0;
  let remappedOffers = 0;

  for (const c of candidates) {
    const mappings = await sql`
      SELECT sm.id, sm.product_url, sm.product_identifier as original_name, p.price, sm.retailer_id
      FROM scraper_mappings sm
      JOIN prices p ON p.product_url = sm.product_url AND p.component_id = sm.component_id
      WHERE sm.component_id = ${c.component_id}
    ` as { id: number; product_url: string; original_name: string; price: number; retailer_id: number }[];

    if (mappings.length === 0) continue;

    const groupsBySpec = new Map<string, typeof mappings>();

    for (const m of mappings) {
      const nameToUse = m.original_name || c.name;
      const specs = c.category === 'ram' ? extractRamSpecs(nameToUse) : extractStorageSpecs(nameToUse);
      
      let specKey: string;
      if (c.category === 'ram') {
        const rs = specs as ReturnType<typeof extractRamSpecs>;
        specKey = `${rs.capacity_gb}|${rs.ram_type}|${rs.frequency_mhz}`;
      } else {
        const ss = specs as ReturnType<typeof extractStorageSpecs>;
        specKey = `${ss.capacity_gb}|${ss.interface_type}`;
      }
        
      const list = groupsBySpec.get(specKey) || [];
      list.push(m);
      groupsBySpec.set(specKey, list);
    }

    if (groupsBySpec.size <= 1) {
      continue;
    }

    const sortedGroups = [...groupsBySpec.entries()].sort((a, b) => b[1].length - a[1].length);
    const [targetSpecKey, targetMembers] = sortedGroups[0];

    for (const [specKey, members] of groupsBySpec.entries()) {
      if (specKey === targetSpecKey) continue;

      const sampleName = members[0].original_name || c.name;
      const brand = c.brand || extractBrand(sampleName) || 'Unknown';
      const newCleanName = cleanName(sampleName, brand, c.category as any);
      const specs = c.category === 'ram' ? extractRamSpecs(sampleName) : extractStorageSpecs(sampleName);
      
      const baseSlug = newCleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const uniqueSlug = generateUniqueSlug(baseSlug, existingSlugs);
      existingSlugs.add(uniqueSlug);

      try {
        const rs = c.category === 'ram' ? (specs as ReturnType<typeof extractRamSpecs>) : null;
        const ss = c.category === 'storage' ? (specs as ReturnType<typeof extractStorageSpecs>) : null;
        
        const [newComp] = await sql`
          INSERT INTO components (
            name, brand, category, capacity_gb, slug, is_active, image_url, image_urls, 
            ram_type, frequency_mhz, kit_count, cas_latency, mpn, interface_type
          )
          SELECT 
            ${newCleanName}, brand, category, ${specs.capacity_gb}, ${uniqueSlug}, true, image_url, image_urls, 
            ${rs?.ram_type ?? null}, ${rs?.frequency_mhz ?? null}, ${rs?.kit_count ?? 1}, ${rs?.cas_latency ?? null}, ${rs?.mpn ?? null}, ${ss?.interface_type ?? null}
          FROM components WHERE id = ${c.component_id}
          RETURNING id
        ` as { id: number }[];

        splitComponents++;

        for (const m of members) {
          await sql`UPDATE scraper_mappings SET component_id = ${newComp.id} WHERE id = ${m.id}`;
          await sql`UPDATE prices SET component_id = ${newComp.id} WHERE component_id = ${c.component_id} AND product_url = ${m.product_url}`;
          remappedOffers++;
        }
      } catch (err) {
        // Fail silently on single component errors and keep processing the rest
      }
    }

    const sampleForTarget = targetMembers[0];
    const targetSpecs = c.category === 'ram' ? extractRamSpecs(sampleForTarget.original_name) : extractStorageSpecs(sampleForTarget.original_name);
    const newOfficialName = cleanName(sampleForTarget.original_name || c.name, c.brand, c.category as any);
    
    const trs = c.category === 'ram' ? (targetSpecs as ReturnType<typeof extractRamSpecs>) : null;
    const tss = c.category === 'storage' ? (targetSpecs as ReturnType<typeof extractStorageSpecs>) : null;
    await sql`
      UPDATE components 
      SET name = ${newOfficialName}, 
          capacity_gb = ${targetSpecs.capacity_gb},
          ram_type = ${trs?.ram_type ?? null},
          frequency_mhz = ${trs?.frequency_mhz ?? null},
          kit_count = ${trs?.kit_count ?? 1},
          cas_latency = ${trs?.cas_latency ?? null},
          mpn = ${trs?.mpn ?? null},
          interface_type = ${tss?.interface_type ?? null}
      WHERE id = ${c.component_id}
    `;
  }

  // 2. Data Quality category fixes
  const resQC1 = await sql`
    UPDATE components SET category = 'ram'
    WHERE category IN ('storage', 'psu')
      AND (name ILIKE '%DDR4%' OR name ILIKE '%DDR5%'
        OR (name ILIKE '%MHz%' AND (name ILIKE '%GB%' OR name ILIKE '%Go%')))
  `;
  const resQC2 = await sql`
    UPDATE components SET category = 'storage', ram_type = NULL, frequency_mhz = NULL, cas_latency = NULL
    WHERE category = 'ram'
      AND (name ILIKE '%TB%' OR name ILIKE '%TO%')
      AND NOT (name ILIKE '%DDR4%' OR name ILIKE '%DDR5%' OR name ILIKE '%MHz%' OR name ILIKE '%DIMM%')
  `;

  const qcCount = (resQC1 as any).count + (resQC2 as any).count;

  return {
    success: true,
    mutatedCount: splitComponents + qcCount,
    message: `Created ${splitComponents} new components, remapped ${remappedOffers} polluted listings, and corrected ${qcCount} categories.`
  };
}
