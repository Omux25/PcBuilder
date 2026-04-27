/**
 * Backfill script — generates slugs for existing components that have none.
 *
 * Run once after migration 006:
 *   bun run backfill_slugs.ts
 *
 * Safe to run multiple times — only updates rows where slug IS NULL.
 * Migration 006 already handles the initial backfill via SQL UPDATE,
 * so this script is a safety net for any rows that may have been missed.
 */

import { sql } from 'bun';
import { componentSlug, generateUniqueSlug } from './src/utils/slugify';

async function backfill() {
  console.log('Starting slug backfill...');

  // Fetch all components without a slug
  const components = await sql`
    SELECT id, name, brand FROM components
    WHERE slug IS NULL
    ORDER BY id ASC
  ` as { id: number; name: string; brand: string | null }[];

  if (components.length === 0) {
    console.log('All components already have slugs. Nothing to do.');
    process.exit(0);
  }

  console.log(`Found ${components.length} component(s) without slugs.`);

  // Fetch all existing slugs to avoid collisions
  const existingRows = await sql`SELECT slug FROM components WHERE slug IS NOT NULL` as { slug: string }[];
  const existingSlugs = new Set(existingRows.map((r) => r.slug));

  let updated = 0;
  let failed = 0;

  for (const component of components) {
    const base = componentSlug(component.brand, component.name);
    const slug = generateUniqueSlug(base, existingSlugs);

    try {
      await sql`
        UPDATE components SET slug = ${slug}, updated_at = NOW()
        WHERE id = ${component.id} AND slug IS NULL
      `;
      existingSlugs.add(slug); // Track so next iteration doesn't collide
      console.log(`  ✓ id=${component.id} → "${slug}"`);
      updated++;
    } catch (err) {
      console.error(`  ✗ id=${component.id} failed: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

backfill().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
