/**
 * Hard reset — drops all application tables and re-runs migrations + retailer seed.
 * Run with: bun reset_db.ts
 */
import { sql } from 'bun';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CurationPersistenceService } from './src/core/services/curationPersistenceService.js';

console.log('⚠️  Dropping all tables...');

// Drop everything in dependency order
await sql.unsafe(`
  DROP TABLE IF EXISTS
    price_history,
    prices,
    scraper_mappings,
    unmatched_suggestions,
    unmatched_listings,
    preset_build_components,
    preset_builds,
    admin_activity_log,
    refresh_tokens,
    scraper_logs,
    admins,
    components,
    retailers,
    _migrations
  CASCADE;
`);

console.log('✅ All tables dropped.');
console.log('🚀 Running migrations...');

await sql`
  CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
`;

const migrationsDir = join(import.meta.dirname, 'src/core/db/migrations');
const files = (await readdir(migrationsDir))
  .filter(f => f.endsWith('.sql'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

for (const file of files) {
  process.stdout.write(`  📄 ${file}... `);
  const content = await readFile(join(migrationsDir, file), 'utf-8');
  await sql.unsafe(content);
  await sql`INSERT INTO _migrations (name) VALUES (${file}) ON CONFLICT DO NOTHING`;
  console.log('✅');
}

console.log('\n🌱 Seeding retailers...');
const retailerSeed = await readFile(join(import.meta.dirname, 'seed/01_retailers.sql'), 'utf-8');
await sql.unsafe(retailerSeed);
console.log('✅ Retailers seeded.');

console.log('\n📦 Seeding curated catalog from backup...');
await CurationPersistenceService.importCuratedCatalog();
console.log('✅ Curated catalog seeded.');

console.log('\n🎉 Clean state ready. Run the scraper next:');
console.log('   bun scripts/tools/run_all_scrapes.ts');

console.log('\n👤 Seeding default admin...');
import bcrypt from 'bcrypt';
const adminHash = await bcrypt.hash('2525', 10);
await sql`
  INSERT INTO admins (username, password_hash)
  VALUES ('omux', ${adminHash})
  ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
`;
console.log('✅ Admin "omux" / "2525" ready.');

process.exit(0);
