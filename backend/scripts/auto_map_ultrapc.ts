/**
 * Auto-mapping script — matches UltraPC products to catalog components.
 *
 * Strategy:
 * 1. Scrape all UltraPC products (2164 products across 10 categories)
 * 2. For each product, normalize the name (lowercase, strip punctuation)
 * 3. For each catalog component, normalize the name the same way
 * 4. Match if the normalized catalog name appears in the normalized product name
 * 5. Insert matched pairs into scraper_mappings
 * 6. Report unmatched products
 *
 * Run with:
 *   bun run scripts/auto_map_ultrapc.ts
 */

import { sql } from 'bun';
import { UltraPcScraper } from '../scraper/scrapers/ultrapcScraper.js';

// ── Normalization ─────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')  // strip punctuation
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim();
}

/**
 * Extracts key identifiers from a component name for matching.
 * e.g. "AMD Ryzen 5 7600X" → ["ryzen", "5", "7600x"]
 *      "NVIDIA GeForce RTX 4070" → ["rtx", "4070"]
 *      "Corsair Vengeance DDR5 32GB 5600MHz" → ["vengeance", "ddr5", "32gb", "5600"]
 */
function extractTokens(name: string): string[] {
  const normalized = normalize(name);
  // Split into tokens and filter out common noise words
  const noise = new Set(['the', 'and', 'or', 'for', 'with', 'box', 'tray', 'mpk',
    'ghz', 'mhz', 'edition', 'series', 'version', 'wraith', 'stealth', 'spire',
    'jusqu', 'a', 'de', 'le', 'la', 'les', 'du', 'des', 'en', 'et', 'ou']);
  return normalized.split(' ').filter((t) => t.length > 1 && !noise.has(t));
}

/**
 * Scores how well a product name matches a catalog component name.
 * Returns a score 0-1 (1 = perfect match).
 */
function matchScore(productName: string, componentName: string): number {
  const productTokens = new Set(extractTokens(productName));
  const componentTokens = extractTokens(componentName);

  if (componentTokens.length === 0) return 0;

  let matched = 0;
  for (const token of componentTokens) {
    if (productTokens.has(token)) matched++;
  }

  return matched / componentTokens.length;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching catalog components...');
  const components = await sql`
    SELECT id, name, brand, category, slug FROM components WHERE is_active = true
  ` as { id: number; name: string; brand: string | null; category: string; slug: string }[];

  console.log(`Loaded ${components.length} catalog components.`);

  console.log('Scraping UltraPC products...');
  const scraper = new UltraPcScraper();
  const products = await scraper.scrapeAllCategories();
  console.log(`Scraped ${products.length} UltraPC products.`);

  // Check existing mappings to avoid duplicates
  const existingMappings = await sql`
    SELECT product_url FROM scraper_mappings WHERE retailer_id = 10
  ` as { product_url: string }[];
  const alreadyMapped = new Set(existingMappings.map((m) => m.product_url));

  console.log(`${alreadyMapped.size} products already mapped. Skipping those.`);

  const MATCH_THRESHOLD = 0.85; // require 85% of component tokens to match
  let mapped = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const product of products) {
    if (alreadyMapped.has(product.product_url)) {
      skipped++;
      continue;
    }

    const productName = product.product_name ?? '';
    if (!productName) { unmatched++; continue; }

    // Find best matching component
    let bestScore = 0;
    let bestComponent: typeof components[0] | null = null;

    for (const component of components) {
      const fullName = component.brand
        ? `${component.brand} ${component.name}`
        : component.name;
      const score = matchScore(productName, fullName);
      if (score > bestScore) {
        bestScore = score;
        bestComponent = component;
      }
    }

    if (bestScore >= MATCH_THRESHOLD && bestComponent) {
      try {
        await sql`
          INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
          VALUES (${bestComponent.id}, 10, ${product.product_url}, ${productName})
          ON CONFLICT (retailer_id, product_url) DO NOTHING
        `;
        mapped++;
        if (mapped <= 20) {
          console.log(`  MAPPED (${(bestScore * 100).toFixed(0)}%): "${productName}"`);
          console.log(`      -> "${bestComponent.brand ?? ''} ${bestComponent.name}" [${bestComponent.category}]`);
        }
      } catch (err) {
        console.error(`  ERROR mapping ${product.product_url}: ${(err as Error).message}`);
      }
    } else {
      unmatched++;
      if (unmatched <= 10) {
        console.log(`  UNMATCHED (best ${(bestScore * 100).toFixed(0)}%): "${productName}"`);
        if (bestComponent) {
          console.log(`      closest: "${bestComponent.brand ?? ''} ${bestComponent.name}"`);
        }
      }
    }
  }

  console.log(`\nDone.`);
  console.log(`  Mapped:    ${mapped}`);
  console.log(`  Skipped:   ${skipped} (already mapped)`);
  console.log(`  Unmatched: ${unmatched}`);

  // Verify by counting
  const totalMappings = await sql`
    SELECT COUNT(id) AS cnt FROM scraper_mappings WHERE retailer_id = 10
  ` as { cnt: string }[];
  console.log(`  Total mappings for UltraPC: ${totalMappings[0].cnt}`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
