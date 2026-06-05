import { getSql } from '../../src/core/db/index.js';
import { componentSlug, generateUniqueSlug } from '@shared/slugify';

async function regenerateAllSlugs() {
  console.log('Starting slug regeneration for all components...');
  const sql = getSql();

  // 1. Fetch all components
  const components = await sql`
    SELECT id, name, brand, slug FROM components
    ORDER BY id ASC
  ` as { id: number; name: string; brand: string | null; slug: string | null }[];

  console.log(`Fetched ${components.length} components from database.`);

  const newSlugs = new Set<string>();
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const component of components) {
    // Generate new naturally-ordered base slug
    const base = componentSlug(component.brand, component.name);
    const targetSlug = generateUniqueSlug(base, newSlugs);

    // Track the generated slug so subsequent iterations don't collide
    newSlugs.add(targetSlug);

    // If the slug didn't change, skip the DB write
    if (component.slug === targetSlug) {
      skipped++;
      continue;
    }

    try {
      await sql`
        UPDATE components
        SET slug = ${targetSlug}, updated_at = NOW()
        WHERE id = ${component.id}
      `;
      console.log(`  ✓ id=${component.id} | "${component.slug}" → "${targetSlug}"`);
      updated++;
    } catch (err) {
      console.error(`  ✗ id=${component.id} failed: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\nSlug regeneration completed!`);
  console.log(`Total components: ${components.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (Unchanged): ${skipped}`);
  console.log(`Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

regenerateAllSlugs().catch((err) => {
  console.error('Fatal regeneration failure:', err);
  process.exit(1);
});
