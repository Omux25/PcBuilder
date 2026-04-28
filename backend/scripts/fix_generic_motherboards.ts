/**
 * fix_generic_motherboards.ts
 *
 * Adds real motherboard catalog entries for every chipset that currently
 * has products mapped to a "Generic <chipset>" placeholder, then remaps
 * those scraper_mappings to the correct real entry.
 *
 * Strategy per chipset:
 *   - If only one brand/model is mapped → add that specific model
 *   - If multiple brands are mapped → add a representative entry per brand
 *     and remap each URL to the correct brand entry
 *
 * Run: bun scripts/fix_generic_motherboards.ts
 */
import { sql } from 'bun';

// ── Real motherboard entries to add ──────────────────────────────────────────
// Each entry covers a chipset that currently has a generic placeholder.
// We add the most common models found in the mapped products.

const newMotherboards = [
  // ── Intel B560 (LGA1200, DDR4) ────────────────────────────────────────────
  { slug: 'msi-mag-b560-tomahawk-wifi',    name: 'MAG B560 TOMAHAWK WIFI',    brand: 'MSI',     socket: 'LGA1200', chipset: 'B560', ddr: ['DDR4'], maxFreq: 4800, year: 2021 },
  { slug: 'asrock-b560-steel-legend',      name: 'B560 Steel Legend',         brand: 'ASRock',  socket: 'LGA1200', chipset: 'B560', ddr: ['DDR4'], maxFreq: 4800, year: 2021 },

  // ── Intel B660 (LGA1700, DDR4/DDR5) ──────────────────────────────────────
  { slug: 'asus-prime-b660-plus-d4',       name: 'PRIME B660-PLUS D4',        brand: 'ASUS',    socket: 'LGA1700', chipset: 'B660', ddr: ['DDR4'], maxFreq: 4800, year: 2022 },
  { slug: 'gigabyte-b660-gaming-x-ddr4',   name: 'B660 GAMING X DDR4',        brand: 'Gigabyte',socket: 'LGA1700', chipset: 'B660', ddr: ['DDR4'], maxFreq: 4800, year: 2022 },
  { slug: 'msi-mag-b660-tomahawk-wifi',    name: 'MAG B660 TOMAHAWK WIFI',    brand: 'MSI',     socket: 'LGA1700', chipset: 'B660', ddr: ['DDR4'], maxFreq: 4800, year: 2022 },

  // ── Intel B840 (LGA1851, DDR5) ────────────────────────────────────────────
  { slug: 'msi-pro-b840-p-wifi',           name: 'PRO B840-P WIFI',           brand: 'MSI',     socket: 'LGA1851', chipset: 'B840', ddr: ['DDR5'], maxFreq: 6400, year: 2024 },
  { slug: 'msi-b840-gaming-plus-wifi',     name: 'B840 GAMING PLUS WIFI',     brand: 'MSI',     socket: 'LGA1851', chipset: 'B840', ddr: ['DDR5'], maxFreq: 6400, year: 2024 },

  // ── Intel B850 (LGA1851, DDR5) ────────────────────────────────────────────
  { slug: 'msi-mag-b850-tomahawk-max-wifi',name: 'MAG B850 TOMAHAWK MAX WIFI',brand: 'MSI',     socket: 'LGA1851', chipset: 'B850', ddr: ['DDR5'], maxFreq: 9200, year: 2024 },
  { slug: 'msi-b850-gaming-plus-wifi',     name: 'B850 GAMING PLUS WIFI',     brand: 'MSI',     socket: 'LGA1851', chipset: 'B850', ddr: ['DDR5'], maxFreq: 9200, year: 2024 },
  { slug: 'msi-mpg-b850-edge-ti-wifi',     name: 'MPG B850 EDGE TI WIFI',     brand: 'MSI',     socket: 'LGA1851', chipset: 'B850', ddr: ['DDR5'], maxFreq: 9200, year: 2024 },
  { slug: 'msi-pro-b850-p-wifi',           name: 'PRO B850-P WIFI',           brand: 'MSI',     socket: 'LGA1851', chipset: 'B850', ddr: ['DDR5'], maxFreq: 9200, year: 2024 },
  { slug: 'gigabyte-b850-eagle-wifi6e',    name: 'B850 EAGLE WIFI6E',         brand: 'Gigabyte',socket: 'LGA1851', chipset: 'B850', ddr: ['DDR5'], maxFreq: 9200, year: 2024 },
  { slug: 'asus-prime-b850m-a-wifi',       name: 'PRIME B850M-A WIFI',        brand: 'ASUS',    socket: 'LGA1851', chipset: 'B850', ddr: ['DDR5'], maxFreq: 9200, year: 2024 },
  { slug: 'asus-tuf-gaming-b850-plus-wifi',name: 'TUF GAMING B850-PLUS WIFI', brand: 'ASUS',    socket: 'LGA1851', chipset: 'B850', ddr: ['DDR5'], maxFreq: 9200, year: 2024 },

  // ── Intel B860 (LGA1851, DDR5) ────────────────────────────────────────────
  { slug: 'msi-mag-b860-tomahawk-wifi',    name: 'MAG B860 TOMAHAWK WIFI',    brand: 'MSI',     socket: 'LGA1851', chipset: 'B860', ddr: ['DDR5'], maxFreq: 9200, year: 2025 },
  { slug: 'msi-pro-b860-p-wifi',           name: 'PRO B860-P WIFI',           brand: 'MSI',     socket: 'LGA1851', chipset: 'B860', ddr: ['DDR5'], maxFreq: 9200, year: 2025 },
  { slug: 'msi-pro-b860-p',               name: 'PRO B860-P',                brand: 'MSI',     socket: 'LGA1851', chipset: 'B860', ddr: ['DDR5'], maxFreq: 9200, year: 2025 },
  { slug: 'msi-pro-b860-gaming-plus-wifi', name: 'PRO B860 GAMING PLUS WIFI', brand: 'MSI',     socket: 'LGA1851', chipset: 'B860', ddr: ['DDR5'], maxFreq: 9200, year: 2025 },

  // ── AMD X870 (AM5, DDR5) ──────────────────────────────────────────────────
  { slug: 'msi-mag-x870-tomahawk-wifi',    name: 'MAG X870 TOMAHAWK WIFI',    brand: 'MSI',     socket: 'AM5',     chipset: 'X870', ddr: ['DDR5'], maxFreq: 8000, year: 2024 },
  { slug: 'msi-x870-gaming-plus-wifi',     name: 'X870 GAMING PLUS WIFI',     brand: 'MSI',     socket: 'AM5',     chipset: 'X870', ddr: ['DDR5'], maxFreq: 8000, year: 2024 },
  { slug: 'msi-pro-x870-p-wifi',           name: 'PRO X870-P WIFI',           brand: 'MSI',     socket: 'AM5',     chipset: 'X870', ddr: ['DDR5'], maxFreq: 8000, year: 2024 },
  { slug: 'gigabyte-x870-eagle-wifi7',     name: 'X870 EAGLE WIFI7',          brand: 'Gigabyte',socket: 'AM5',     chipset: 'X870', ddr: ['DDR5'], maxFreq: 8000, year: 2024 },
  { slug: 'gigabyte-x870-aorus-elite-wifi7',name:'X870 AORUS ELITE WIFI7',    brand: 'Gigabyte',socket: 'AM5',     chipset: 'X870', ddr: ['DDR5'], maxFreq: 8000, year: 2024 },
  { slug: 'gigabyte-x870-gaming-x-wifi7',  name: 'X870 GAMING X WIFI7',       brand: 'Gigabyte',socket: 'AM5',     chipset: 'X870', ddr: ['DDR5'], maxFreq: 8000, year: 2024 },
  { slug: 'asus-rog-strix-x870-f-gaming-wifi',name:'ROG STRIX X870-F GAMING WIFI',brand:'ASUS', socket: 'AM5',     chipset: 'X870', ddr: ['DDR5'], maxFreq: 8000, year: 2024 },
  { slug: 'asus-rog-strix-x870-a-gaming-wifi',name:'ROG STRIX X870-A GAMING WIFI',brand:'ASUS', socket: 'AM5',     chipset: 'X870', ddr: ['DDR5'], maxFreq: 8000, year: 2024 },

  // ── AMD X870E (AM5, DDR5) ─────────────────────────────────────────────────
  { slug: 'msi-mpg-x870e-carbon-wifi',     name: 'MPG X870E CARBON WIFI',     brand: 'MSI',     socket: 'AM5',     chipset: 'X870E',ddr: ['DDR5'], maxFreq: 9200, year: 2024 },
  { slug: 'msi-x870e-gaming-plus-wifi',    name: 'X870E GAMING PLUS WIFI',    brand: 'MSI',     socket: 'AM5',     chipset: 'X870E',ddr: ['DDR5'], maxFreq: 9200, year: 2024 },
  { slug: 'msi-pro-x870e-p-wifi',          name: 'PRO X870E-P WIFI',          brand: 'MSI',     socket: 'AM5',     chipset: 'X870E',ddr: ['DDR5'], maxFreq: 9200, year: 2024 },
  { slug: 'msi-mpg-x870e-edge-ti-wifi',    name: 'MPG X870E EDGE TI WIFI',    brand: 'MSI',     socket: 'AM5',     chipset: 'X870E',ddr: ['DDR5'], maxFreq: 9200, year: 2024 },
  { slug: 'gigabyte-x870e-aorus-pro',      name: 'X870E AORUS PRO',           brand: 'Gigabyte',socket: 'AM5',     chipset: 'X870E',ddr: ['DDR5'], maxFreq: 9200, year: 2024 },
  { slug: 'gigabyte-x870e-aorus-pro-ice',  name: 'X870E AORUS PRO ICE',       brand: 'Gigabyte',socket: 'AM5',     chipset: 'X870E',ddr: ['DDR5'], maxFreq: 9200, year: 2024 },
  { slug: 'asus-rog-strix-x870e-e-gaming-wifi',name:'ROG STRIX X870E-E GAMING WIFI',brand:'ASUS',socket:'AM5',     chipset: 'X870E',ddr: ['DDR5'], maxFreq: 9200, year: 2024 },
  { slug: 'asus-proart-x870e-creator-wifi',name: 'ProArt X870E-CREATOR WIFI', brand: 'ASUS',    socket: 'AM5',     chipset: 'X870E',ddr: ['DDR5'], maxFreq: 9200, year: 2024 },

  // ── Intel Z390 (LGA1151, DDR4) ────────────────────────────────────────────
  { slug: 'msi-mag-z390-tomahawk',         name: 'MAG Z390 TOMAHAWK',         brand: 'MSI',     socket: 'LGA1151', chipset: 'Z390', ddr: ['DDR4'], maxFreq: 4400, year: 2018 },
  { slug: 'msi-z390-a-pro',               name: 'Z390-A PRO',                brand: 'MSI',     socket: 'LGA1151', chipset: 'Z390', ddr: ['DDR4'], maxFreq: 4400, year: 2018 },
  { slug: 'msi-mpg-z390-gaming-pro-carbon',name:'MPG Z390 GAMING PRO CARBON', brand: 'MSI',     socket: 'LGA1151', chipset: 'Z390', ddr: ['DDR4'], maxFreq: 4400, year: 2018 },
  { slug: 'asrock-z390-pro4',             name: 'Z390 PRO4',                 brand: 'ASRock',  socket: 'LGA1151', chipset: 'Z390', ddr: ['DDR4'], maxFreq: 4400, year: 2018 },
  { slug: 'gigabyte-z390-ud',             name: 'Z390 UD',                   brand: 'Gigabyte',socket: 'LGA1151', chipset: 'Z390', ddr: ['DDR4'], maxFreq: 4266, year: 2018 },

  // ── Intel Z490 (LGA1200, DDR4) ────────────────────────────────────────────
  { slug: 'asus-rog-strix-z490-f-gaming',  name: 'ROG STRIX Z490-F GAMING',   brand: 'ASUS',    socket: 'LGA1200', chipset: 'Z490', ddr: ['DDR4'], maxFreq: 4800, year: 2020 },
  { slug: 'msi-mag-z490-tomahawk',         name: 'MAG Z490 TOMAHAWK',         brand: 'MSI',     socket: 'LGA1200', chipset: 'Z490', ddr: ['DDR4'], maxFreq: 4800, year: 2020 },
  { slug: 'msi-z490-a-pro',               name: 'Z490-A PRO',                brand: 'MSI',     socket: 'LGA1200', chipset: 'Z490', ddr: ['DDR4'], maxFreq: 4800, year: 2020 },
  { slug: 'asrock-z490-pg-velocita',       name: 'Z490 PG Velocita',          brand: 'ASRock',  socket: 'LGA1200', chipset: 'Z490', ddr: ['DDR4'], maxFreq: 4800, year: 2020 },
  { slug: 'asrock-z490-phantom-gaming-4',  name: 'Z490 Phantom Gaming 4',     brand: 'ASRock',  socket: 'LGA1200', chipset: 'Z490', ddr: ['DDR4'], maxFreq: 4800, year: 2020 },

  // ── Intel Z590 (LGA1200, DDR4) ────────────────────────────────────────────
  { slug: 'msi-mag-z590-torpedo',          name: 'MAG Z590 TORPEDO',          brand: 'MSI',     socket: 'LGA1200', chipset: 'Z590', ddr: ['DDR4'], maxFreq: 5333, year: 2021 },
  { slug: 'msi-z590-a-pro',               name: 'Z590-A PRO',                brand: 'MSI',     socket: 'LGA1200', chipset: 'Z590', ddr: ['DDR4'], maxFreq: 5333, year: 2021 },
  { slug: 'asrock-z590-steel-legend',      name: 'Z590 Steel Legend',         brand: 'ASRock',  socket: 'LGA1200', chipset: 'Z590', ddr: ['DDR4'], maxFreq: 5333, year: 2021 },
  { slug: 'gigabyte-z590-gaming-x',        name: 'Z590 GAMING X',             brand: 'Gigabyte',socket: 'LGA1200', chipset: 'Z590', ddr: ['DDR4'], maxFreq: 5333, year: 2021 },
  { slug: 'gigabyte-z590-aorus-pro-ax',    name: 'Z590 AORUS PRO AX',         brand: 'Gigabyte',socket: 'LGA1200', chipset: 'Z590', ddr: ['DDR4'], maxFreq: 5333, year: 2021 },
  { slug: 'asrock-z590-phantom-gaming-4',  name: 'Z590 Phantom Gaming 4',     brand: 'ASRock',  socket: 'LGA1200', chipset: 'Z590', ddr: ['DDR4'], maxFreq: 5333, year: 2021 },

  // ── Intel B365 (LGA1151, DDR4) ────────────────────────────────────────────
  { slug: 'asrock-b365-pro4',             name: 'B365 Pro4',                 brand: 'ASRock',  socket: 'LGA1151', chipset: 'B365', ddr: ['DDR4'], maxFreq: 2666, year: 2018 },

  // ── Intel H410 (LGA1200, DDR4) ────────────────────────────────────────────
  { slug: 'asus-prime-h410m-k',           name: 'PRIME H410M-K',             brand: 'ASUS',    socket: 'LGA1200', chipset: 'H410', ddr: ['DDR4'], maxFreq: 2933, year: 2020 },

  // ── Intel H670 (LGA1700, DDR4/DDR5) ──────────────────────────────────────
  { slug: 'asrock-h670-steel-legend',     name: 'H670 Steel Legend',         brand: 'ASRock',  socket: 'LGA1700', chipset: 'H670', ddr: ['DDR4', 'DDR5'], maxFreq: 4800, year: 2022 },
];

// ── Socket/DDR specs lookup ───────────────────────────────────────────────────
const socketSpecs: Record<string, { tdp: number }> = {
  'LGA1151': { tdp: 15 }, 'LGA1200': { tdp: 15 }, 'LGA1700': { tdp: 15 },
  'LGA1851': { tdp: 15 }, 'AM4': { tdp: 15 }, 'AM5': { tdp: 15 },
};

// ── Insert new motherboard entries ────────────────────────────────────────────
console.log('\n=== Inserting real motherboard entries ===');
let inserted = 0;
let skipped = 0;

for (const mb of newMotherboards) {
  const specs = {
    socket: mb.socket,
    chipset: mb.chipset,
    form_factor: 'ATX',
    ram_slots: 4,
    max_ram_gb: mb.socket === 'LGA1851' || mb.socket === 'AM5' ? 256 : 128,
    supported_ram_types: mb.ddr,
    max_ram_frequency: mb.maxFreq,
  };

  const result = await sql`
    INSERT INTO components (
      slug, name, brand, category, socket,
      supported_ram_types, max_ram_frequency, tdp,
      specs, release_year, is_active
    ) VALUES (
      ${mb.slug}, ${mb.name}, ${mb.brand}, 'motherboard', ${mb.socket},
      ${sql.array(mb.ddr)}, ${mb.maxFreq}, ${socketSpecs[mb.socket]?.tdp ?? 15},
      ${JSON.stringify(specs)}, ${mb.year}, true
    )
    ON CONFLICT (slug) DO UPDATE SET
      is_active = true,
      name = EXCLUDED.name,
      brand = EXCLUDED.brand,
      socket = EXCLUDED.socket,
      supported_ram_types = EXCLUDED.supported_ram_types,
      max_ram_frequency = EXCLUDED.max_ram_frequency,
      specs = EXCLUDED.specs,
      release_year = EXCLUDED.release_year
    RETURNING id, slug
  ` as { id: number; slug: string }[];

  if (result.length > 0) {
    console.log(`  ✓ [${result[0].id}] ${mb.brand} ${mb.name}`);
    inserted++;
  } else {
    skipped++;
  }
}

console.log(`\nInserted/updated: ${inserted}, skipped: ${skipped}`);

// ── Remap scraper_mappings from generic → real entries ────────────────────────
// For each generic component, find its mapped URLs and remap them to the
// correct real entry based on the product name in the URL or prices table.

console.log('\n=== Remapping scraper_mappings ===');

// Get all mappings pointing to generic motherboards
const genericMappings = await sql`
  SELECT
    sm.id AS mapping_id,
    sm.component_id AS old_component_id,
    sm.retailer_id,
    sm.product_url,
    c.name AS generic_name,
    COALESCE(p.price, 0) AS price,
    -- Try to get the scraped product name from prices table product_url path
    sm.product_url AS url
  FROM scraper_mappings sm
  JOIN components c ON c.id = sm.component_id
  LEFT JOIN prices p ON p.component_id = sm.component_id
    AND p.retailer_id = sm.retailer_id
    AND p.product_url = sm.product_url
  WHERE c.category = 'motherboard'
    AND (c.brand ILIKE '%generic%' OR c.name ILIKE '%generic%')
  ORDER BY c.name, sm.retailer_id
` as {
  mapping_id: number; old_component_id: number; retailer_id: number;
  product_url: string; generic_name: string; price: number; url: string;
}[];

console.log(`Found ${genericMappings.length} mappings to remap`);

// Build a lookup: slug → component_id for all new real entries
const realEntries = await sql`
  SELECT id, slug, name, brand
  FROM components
  WHERE category = 'motherboard'
    AND is_active = true
    AND brand NOT ILIKE '%generic%'
    AND name NOT ILIKE '%generic%'
` as { id: number; slug: string; name: string; brand: string }[];

// Extract chipset from a component name (e.g. "MAG B560 TOMAHAWK WIFI" → "b560")
function extractChipset(name: string): string {
  const m = name.match(/\b([A-Z][0-9]{3,4}[EI]?)\b/i);
  return m ? m[1].toLowerCase() : '';
}

// Helper: find best matching real entry for a product URL
function findBestMatch(productUrl: string, genericName: string): number | null {
  const urlLower = productUrl.toLowerCase();

  // Extract chipset from generic name (e.g. "Generic B560 (generic)" → "b560")
  const chipsetMatch = genericName.match(/\b([A-Z][0-9]{3,4}[EI]?)\b/i);
  const chipset = chipsetMatch ? chipsetMatch[1].toLowerCase() : '';

  // Filter candidates to same chipset (extracted from their name)
  const candidates = realEntries.filter(e => extractChipset(e.name) === chipset);

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].id;

  // Score each candidate by how many slug words appear in the URL
  const scored = candidates.map(c => {
    const slugWords = c.slug.split('-').filter(w => w.length > 2);
    const score = slugWords.filter(w => urlLower.includes(w)).length;
    return { id: c.id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  if (scored[0].score > 0) return scored[0].id;

  // Fall back to first candidate (same chipset)
  return candidates[0].id;
}

let remapped = 0;
let noMatch = 0;

for (const mapping of genericMappings) {
  const newId = findBestMatch(mapping.product_url, mapping.generic_name);

  if (!newId) {
    console.log(`  ✗ No match for: ${mapping.product_url} (${mapping.generic_name})`);
    noMatch++;
    continue;
  }

  // Update scraper_mapping
  await sql`
    UPDATE scraper_mappings
    SET component_id = ${newId}
    WHERE id = ${mapping.mapping_id}
  `;

  // Update prices table
  await sql`
    UPDATE prices
    SET component_id = ${newId}
    WHERE component_id = ${mapping.old_component_id}
      AND retailer_id = ${mapping.retailer_id}
      AND product_url = ${mapping.product_url}
  `;

  // Update price_history
  await sql`
    UPDATE price_history
    SET component_id = ${newId}
    WHERE component_id = ${mapping.old_component_id}
      AND retailer_id = ${mapping.retailer_id}
  `;

  remapped++;
}

console.log(`\nRemapped: ${remapped}, no match: ${noMatch}`);

// ── Final summary ─────────────────────────────────────────────────────────────
const remaining = await sql`
  SELECT COUNT(*) as count FROM scraper_mappings sm
  JOIN components c ON c.id = sm.component_id
  WHERE c.brand ILIKE '%generic%' OR c.name ILIKE '%generic%'
` as { count: number }[];

console.log(`\nRemaining mappings to generic components: ${remaining[0].count}`);
console.log('Done. Run the scraper to refresh prices for the new entries.');

process.exit(0);
