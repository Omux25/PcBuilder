/**
 * Auto-mapping script for NextLevel PC (retailer_id = 11).
 * Scrapes all categories, then fuzzy-matches against catalog components.
 */

import { sql } from 'bun';
import { NextLevelScraper } from '../scraper/scrapers/nextlevelScraper.js';
import { componentSlug } from '../src/utils/slugify.js';

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTokens(name: string): string[] {
  const noise = new Set(['the', 'and', 'or', 'for', 'with', 'box', 'tray', 'mpk', 'ghz',
    'mhz', 'edition', 'series', 'version', 'wraith', 'stealth', 'spire', 'fan', 'no',
    'jusqu', 'a', 'de', 'le', 'la', 'les', 'du', 'des', 'en', 'et', 'ou']);
  return normalize(name).split(' ').filter((t) => t.length > 1 && !noise.has(t));
}

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

async function main() {
  console.log('Scraping NextLevel PC...');
  const scraper = new NextLevelScraper();
  const products = await scraper.scrapeAllCategories();
  console.log(`Scraped ${products.length} products.`);

  const components = await sql`
    SELECT id, name, brand, category FROM components WHERE is_active = true
  ` as { id: number; name: string; brand: string | null; category: string }[];

  const existing = await sql`
    SELECT product_url FROM scraper_mappings WHERE retailer_id = 11
  ` as { product_url: string }[];
  const alreadyMapped = new Set(existing.map((r) => r.product_url));

  let mapped = 0, skipped = 0, unmatched = 0;

  for (const product of products) {
    if (alreadyMapped.has(product.product_url)) { skipped++; continue; }
    const productName = product.product_name ?? '';
    if (!productName) { unmatched++; continue; }

    let bestScore = 0;
    let bestComponent: typeof components[0] | null = null;

    for (const component of components) {
      const fullName = component.brand ? `${component.brand} ${component.name}` : component.name;
      const score = matchScore(productName, fullName);
      if (score > bestScore) { bestScore = score; bestComponent = component; }
    }

    if (bestScore >= 0.85 && bestComponent) {
      try {
        await sql`
          INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
          VALUES (${bestComponent.id}, 11, ${product.product_url}, ${productName})
          ON CONFLICT (retailer_id, product_url) DO NOTHING
        `;
        mapped++;
      } catch { /* skip */ }
    } else {
      unmatched++;
    }
  }

  console.log(`Done. Mapped: ${mapped}, Skipped: ${skipped}, Unmatched: ${unmatched}`);
  const total = await sql`SELECT COUNT(id) AS cnt FROM scraper_mappings WHERE retailer_id = 11` as { cnt: string }[];
  console.log(`Total NextLevel mappings: ${total[0].cnt}`);
}

main().catch(console.error);
