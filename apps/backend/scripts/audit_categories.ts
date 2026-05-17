// apps/backend/scripts/audit_categories.ts
import { getSql } from '../src/core/db/index.js';
import { inferCategory, inferCategoryFromUrl, getCategoryPriority, extractBrand } from '@shared/component-utils';
import { deriveCanonicalName } from '../src/modules/scraping/services/suggestionEngine.js';
import { logger } from '../src/modules/scraping/engine/utils/logger.js';

function resolveCategory(name: string, url?: string) {
  const catByName = inferCategory(name);
  const catByUrl = url ? inferCategoryFromUrl(url) : null;

  if (!catByName && !catByUrl) return null;
  if (!catByName) return catByUrl;
  if (!catByUrl) return catByName;

  return getCategoryPriority(catByName as any) >= getCategoryPriority(catByUrl as any) ? catByName : catByUrl;
}

async function main() {
  const sql = getSql();
  console.log('Starting system-wide category audit (Priority System)...');

  // 1. Audit unmatched_listings
  const unmatched = (await sql`
    SELECT ul.id, ul.scraped_name, ul.product_url, us.category as sug_category 
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    WHERE ul.status = 'pending'
  `) as { id: number; scraped_name: string; product_url: string; sug_category: string | null }[];

  console.log(`Auditing ${unmatched.length} pending unmatched listings...`);
  let unmatchedFixed = 0;

  for (const item of unmatched) {
    const resolved = resolveCategory(item.scraped_name, item.product_url);

    if (resolved && resolved !== item.sug_category) {
      const brand = extractBrand(item.scraped_name);
      const canonicalName = deriveCanonicalName(item.scraped_name, brand);

      await sql`
        INSERT INTO unmatched_suggestions (unmatched_listing_id, category, confidence, canonical_name, brand, computed_at)
        VALUES (${item.id}, ${resolved}, 'high', ${canonicalName}, ${brand}, NOW())
        ON CONFLICT (unmatched_listing_id) DO UPDATE SET
          category = EXCLUDED.category,
          confidence = EXCLUDED.confidence,
          canonical_name = EXCLUDED.canonical_name,
          brand = EXCLUDED.brand,
          computed_at = NOW()
      `;
      unmatchedFixed++;
    }
  }
  console.log(`Updated ${unmatchedFixed} suggestions in unmatched_listings.`);

  // 2. Audit existing components and their mappings
  const mappings = (await sql`
    SELECT sm.id, sm.retailer_id, sm.product_url, sm.product_identifier, c.id as component_id, c.name, c.category as current_category
    FROM scraper_mappings sm
    JOIN components c ON c.id = sm.component_id
    WHERE c.is_active = true
  `) as { id: number; retailer_id: number; product_url: string; product_identifier: string; component_id: number; name: string; current_category: string }[];

  console.log(`Auditing ${mappings.length} catalog mappings...`);
  let mappingIssues = 0;
  const issues: any[] = [];

  for (const m of mappings) {
    const suggested = resolveCategory(m.product_identifier || m.name, m.product_url);

    if (suggested && suggested !== m.current_category) {
      issues.push({
        component_id: m.component_id,
        name: m.name,
        current: m.current_category,
        suggested,
        url: m.product_url
      });
      mappingIssues++;
    }
  }

  if (issues.length > 0) {
    console.log(`\nFound ${mappingIssues} potential miscategorizations in the active catalog:`);
    const groups: Record<string, any[]> = {};
    for (const issue of issues) {
      const key = `${issue.current} -> ${issue.suggested}`;
      groups[key] = groups[key] || [];
      groups[key].push(issue);
    }

    for (const [key, items] of Object.entries(groups)) {
      console.log(`\n[${key}] - ${items.length} items`);
      items.slice(0, 10).forEach(i => {
        console.log(`  - ${i.name} (${i.url})`);
      });
      if (items.length > 10) console.log(`  ... and ${items.length - 10} more`);
    }
  } else {
    console.log('No miscategorization issues found in the active catalog.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

main().catch(err => {
  console.error(err);
  process.exit(1);
});
