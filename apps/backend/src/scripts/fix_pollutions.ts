
import { getSql } from '../core/db/index.js';
import { extractRamSpecs, extractStorageSpecs, cleanName, extractBrand } from '@shared/component-utils';
import { generateUniqueSlug } from '@shared/slugify';

async function fixPollutions() {
  const sql = getSql();
  console.log('🚀 Starting Catalog Pollution Fixer (Enhanced Edition)...');

  // 1. Find components with high price variance
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

  console.log(`Found ${candidates.length} candidate components for splitting.`);

  // Get all existing slugs once to avoid O(N^2) slug queries
  const existingSlugsRows = await sql`SELECT slug FROM components WHERE slug IS NOT NULL` as { slug: string }[];
  const existingSlugs = new Set(existingSlugsRows.map(r => r.slug));

  for (const c of candidates) {
    console.log(`\n📦 Investigating "${c.name}" (ID: ${c.component_id}, Category: ${c.category})`);

    // Get original names from scraper_mappings
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
      
      const specKey = c.category === 'ram' 
        ? `${specs.capacity_gb}|${specs.ram_type}|${specs.frequency_mhz}`
        : `${specs.capacity_gb}|${(specs as any).interface_type}`;
        
      const list = groupsBySpec.get(specKey) || [];
      list.push(m);
      groupsBySpec.set(specKey, list);
    }

    if (groupsBySpec.size <= 1) {
      console.log(`   Skipping: only one spec group (${[...groupsBySpec.keys()][0]}) detected.`);
      continue;
    }

    console.log(`   Detected spec groups: ${[...groupsBySpec.keys()].join(', ')}`);

    // Pick target group (majority)
    const sortedGroups = [...groupsBySpec.entries()].sort((a, b) => b[1].length - a[1].length);
    const [targetSpecKey, targetMembers] = sortedGroups[0];
    
    console.log(`   Keeping ID ${c.component_id} for group ${targetSpecKey}.`);

    // Handle other groups
    for (const [specKey, members] of groupsBySpec.entries()) {
      if (specKey === targetSpecKey) continue;

      console.log(`   Splitting ${members.length} listings into new component for ${specKey}...`);

      const sampleName = members[0].original_name || c.name;
      const brand = c.brand || extractBrand(sampleName);
      const newCleanName = cleanName(sampleName, brand, c.category);
      const specs = c.category === 'ram' ? extractRamSpecs(sampleName) : extractStorageSpecs(sampleName);
      
      const baseSlug = newCleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const uniqueSlug = generateUniqueSlug(baseSlug, existingSlugs);
      existingSlugs.add(uniqueSlug);

      try {
        const [newComp] = await sql`
          INSERT INTO components (name, brand, category, capacity_gb, slug, is_active, image_url, image_urls, ram_type, frequency_mhz)
          SELECT ${newCleanName}, brand, category, ${specs.capacity_gb}, ${uniqueSlug}, true, image_url, image_urls, ${c.category === 'ram' ? specs.ram_type : null}, ${c.category === 'ram' ? specs.frequency_mhz : null}
          FROM components WHERE id = ${c.component_id}
          RETURNING id
        ` as { id: number }[];

        console.log(`   ✅ Created new component ID: ${newComp.id} (${newCleanName})`);

        for (const m of members) {
          await sql`UPDATE scraper_mappings SET component_id = ${newComp.id} WHERE id = ${m.id}`;
          await sql`UPDATE prices SET component_id = ${newComp.id} WHERE component_id = ${c.component_id} AND product_url = ${m.product_url}`;
        }
        console.log(`      Moved ${members.length} listings.`);
      } catch (err) {
        console.error(`      ❌ Failed to split spec ${specKey}:`, err);
      }
    }

    // Update original
    const sampleForTarget = targetMembers[0];
    const targetSpecs = c.category === 'ram' ? extractRamSpecs(sampleForTarget.original_name) : extractStorageSpecs(sampleForTarget.original_name);
    const newOfficialName = cleanName(sampleForTarget.original_name || c.name, c.brand, c.category);
    
    await sql`
      UPDATE components 
      SET name = ${newOfficialName}, 
          capacity_gb = ${targetSpecs.capacity_gb},
          ram_type = ${c.category === 'ram' ? targetSpecs.ram_type : null},
          frequency_mhz = ${c.category === 'ram' ? targetSpecs.frequency_mhz : null}
      WHERE id = ${c.component_id}
    `;
    console.log(`   Updated original component ID ${c.component_id} to ${targetSpecKey} (${newOfficialName}).`);
  }

  // 2. Run Data Quality Pass to fix categories
  console.log('\n🧹 Running Data Quality Pass to fix categories...');
  await sql`
    UPDATE components SET category = 'ram'
    WHERE category IN ('storage', 'psu')
      AND (name ILIKE '%DDR4%' OR name ILIKE '%DDR5%'
        OR (name ILIKE '%MHz%' AND (name ILIKE '%GB%' OR name ILIKE '%Go%')))
  `;
  await sql`
    UPDATE components SET category = 'storage', ram_type = NULL, frequency_mhz = NULL, cas_latency = NULL
    WHERE category = 'ram'
      AND (name ILIKE '%TB%' OR name ILIKE '%TO%')
      AND NOT (name ILIKE '%DDR4%' OR name ILIKE '%DDR5%' OR name ILIKE '%MHz%' OR name ILIKE '%DIMM%')
  `;

  console.log('\n✨ Catalog Pollution Fixer finished.');
}

fixPollutions().catch(console.error);
