/**
 * fix_generic_psus.ts
 *
 * Adds real PSU catalog entries for the high-wattage generics that had
 * correct PSU products mapped to them (1050W, 1250W, 1500W, 1600W, 1650W).
 * Then remaps those scraper_mappings to the correct real entries.
 *
 * Note: 500W/600W/700W generic PSU mappings were already deleted by
 * fix_generic_components.sql because they were all wrong (SSDs, coolers, cases).
 *
 * Run: bun scripts/fix_generic_psus.ts
 */
import { sql } from 'bun';

const newPsus = [
  // ── 1050W ─────────────────────────────────────────────────────────────────
  { slug: 'cooler-master-mwe-gold-1050-v2',      name: 'MWE Gold 1050 Full Modular V2',         brand: 'Cooler Master', wattage: 1050, rating: '80+ Gold',     modular: 'Fully modular', year: 2022 },

  // ── 1250W ─────────────────────────────────────────────────────────────────
  { slug: 'msi-mag-a1250gl-pcie5',               name: 'MAG A1250GL PCIE5 1250W',               brand: 'MSI',           wattage: 1250, rating: '80+ Gold',     modular: 'Fully modular', year: 2023 },
  { slug: 'msi-mpg-a1250gs-pcie5',               name: 'MPG A1250GS PCIE5 1250W',               brand: 'MSI',           wattage: 1250, rating: '80+ Gold',     modular: 'Fully modular', year: 2023 },
  { slug: 'cooler-master-mwe-gold-1250-v2',      name: 'MWE Gold 1250 Full Modular V2',         brand: 'Cooler Master', wattage: 1250, rating: '80+ Gold',     modular: 'Fully modular', year: 2022 },

  // ── 1500W ─────────────────────────────────────────────────────────────────
  { slug: 'corsair-hx1500i',                     name: 'HX1500i 1500W Platinum',                brand: 'Corsair',       wattage: 1500, rating: '80+ Platinum', modular: 'Fully modular', year: 2022 },

  // ── 1600W ─────────────────────────────────────────────────────────────────
  { slug: 'asus-rog-thor-1600w-titanium-iii',    name: 'ROG THOR 1600W Titanium III',           brand: 'ASUS',          wattage: 1600, rating: '80+ Titanium', modular: 'Fully modular', year: 2023 },
  { slug: 'seasonic-prime-px-1600',              name: 'PRIME PX-1600 1600W Platinum',          brand: 'Seasonic',      wattage: 1600, rating: '80+ Platinum', modular: 'Fully modular', year: 2022 },
  { slug: 'msi-meg-ai1600t-pcie5',               name: 'MEG Ai1600T 1600W Titanium PCIE5',      brand: 'MSI',           wattage: 1600, rating: '80+ Titanium', modular: 'Fully modular', year: 2023 },

  // ── 1650W ─────────────────────────────────────────────────────────────────
  { slug: 'thermaltake-toughpower-gf3-1650w',    name: 'Toughpower GF3 1650W Gold',             brand: 'Thermaltake',   wattage: 1650, rating: '80+ Gold',     modular: 'Fully modular', year: 2023 },
];

console.log('\n=== Inserting real PSU entries ===');
let inserted = 0;

for (const psu of newPsus) {
  const specs = {
    wattage: psu.wattage,
    efficiency_rating: psu.rating,
    modular: psu.modular,
    form_factor: 'ATX',
  };

  const result = await sql`
    INSERT INTO components (slug, name, brand, category, wattage, specs, release_year, is_active)
    VALUES (
      ${psu.slug}, ${psu.name}, ${psu.brand}, 'psu',
      ${psu.wattage}, ${JSON.stringify(specs)}, ${psu.year}, true
    )
    ON CONFLICT (slug) DO UPDATE SET
      is_active = true,
      name = EXCLUDED.name,
      brand = EXCLUDED.brand,
      wattage = EXCLUDED.wattage,
      specs = EXCLUDED.specs
    RETURNING id, slug
  ` as { id: number; slug: string }[];

  if (result.length > 0) {
    console.log(`  ✓ [${result[0].id}] ${psu.brand} ${psu.name}`);
    inserted++;
  }
}

console.log(`\nInserted/updated: ${inserted}`);

// ── Remap PSU generic mappings ────────────────────────────────────────────────
console.log('\n=== Remapping PSU generic mappings ===');

const genericPsuMappings = await sql`
  SELECT
    sm.id AS mapping_id,
    sm.component_id AS old_component_id,
    sm.retailer_id,
    sm.product_url,
    c.name AS generic_name
  FROM scraper_mappings sm
  JOIN components c ON c.id = sm.component_id
  WHERE c.category = 'psu'
    AND (c.brand ILIKE '%generic%' OR c.name ILIKE '%generic%')
  ORDER BY c.name
` as { mapping_id: number; old_component_id: number; retailer_id: number; product_url: string; generic_name: string }[];

console.log(`Found ${genericPsuMappings.length} PSU mappings to remap`);

// Build lookup: wattage → real PSU entries
const realPsus = await sql`
  SELECT id, slug, name, brand, wattage
  FROM components
  WHERE category = 'psu'
    AND is_active = true
    AND brand NOT ILIKE '%generic%'
  ORDER BY wattage, brand
` as { id: number; slug: string; name: string; brand: string; wattage: number }[];

function findPsuMatch(productUrl: string, genericName: string): number | null {
  const urlLower = productUrl.toLowerCase();

  // Extract wattage from generic name
  const wattMatch = genericName.match(/(\d{3,4})W/i);
  if (!wattMatch) return null;
  const wattage = parseInt(wattMatch[1]);

  const candidates = realPsus.filter(p => p.wattage === wattage);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].id;

  // Match by brand in URL
  for (const c of candidates) {
    const brandLower = c.brand.toLowerCase().replace(/[^a-z]/g, '');
    if (urlLower.includes(brandLower)) return c.id;
    if (urlLower.includes('msi') && c.brand === 'MSI') return c.id;
    if (urlLower.includes('asus') && c.brand === 'ASUS') return c.id;
    if (urlLower.includes('corsair') && c.brand === 'Corsair') return c.id;
    if (urlLower.includes('seasonic') && c.brand === 'Seasonic') return c.id;
    if (urlLower.includes('cooler') && c.brand === 'Cooler Master') return c.id;
    if (urlLower.includes('thermaltake') && c.brand === 'Thermaltake') return c.id;
  }

  // Match by model name words in URL
  for (const c of candidates) {
    const nameWords = c.name.toLowerCase().split(' ').filter(w => w.length > 3);
    const matches = nameWords.filter(w => urlLower.includes(w));
    if (matches.length >= 2) return c.id;
  }

  return candidates[0].id;
}

let remapped = 0;
let noMatch = 0;

for (const mapping of genericPsuMappings) {
  const newId = findPsuMatch(mapping.product_url, mapping.generic_name);

  if (!newId) {
    console.log(`  ✗ No match: ${mapping.product_url}`);
    noMatch++;
    continue;
  }

  await sql`UPDATE scraper_mappings SET component_id = ${newId} WHERE id = ${mapping.mapping_id}`;
  await sql`
    UPDATE prices SET component_id = ${newId}
    WHERE component_id = ${mapping.old_component_id}
      AND retailer_id = ${mapping.retailer_id}
      AND product_url = ${mapping.product_url}
  `;
  await sql`
    UPDATE price_history SET component_id = ${newId}
    WHERE component_id = ${mapping.old_component_id}
      AND retailer_id = ${mapping.retailer_id}
  `;

  remapped++;
}

console.log(`\nRemapped: ${remapped}, no match: ${noMatch}`);
process.exit(0);
