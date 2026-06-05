/**
 * PC Builder Migration Runner
 *
 * Programmatically executes SQL migration files in sequence.
 * Tracks executed migrations in a `_migrations` table to ensure idempotency.
 *
 * Usage: bun src/db/migrate.ts
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSql } from './index.js';
import type { SqlFn } from './index.js';

async function migrate() {
  const sql = getSql();
  const migrationsDir = join(import.meta.dirname, 'migrations');

  console.log('\n🚀 Starting Database Migrations...');

  // 1. Ensure migrations tracking table exists
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  // 2. Read and sort migration files
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  if (files.length === 0) {
    console.log('✨ No migration files found.');
    return;
  }

  // 3. Get already executed migrations
  const executed = (await sql`SELECT name FROM _migrations`) as { name: string }[];
  const executedNames = new Set(executed.map(e => e.name));

  let count = 0;

  // 4. Run new migrations in sequence
  for (const file of files) {
    if (executedNames.has(file)) {
      continue;
    }

    console.log(`  📄 Running ${file}...`);
    const content = await readFile(join(migrationsDir, file), 'utf-8');

    try {
      // Execute within a transaction for safety
      await sql.begin(async (tx: SqlFn) => {
        // Bun.sql doesn't support multiple statements in one tagged template easily
        // if they are complex, but most migration files are batches.
        // We execute the raw content.
        await tx.unsafe(content);
        await tx`INSERT INTO _migrations (name) VALUES (${file})`;
      });
      console.log(`  ✅ ${file} completed.`);
      count++;
    } catch (err) {
      console.error(`  ❌ Error in ${file}:`);
      console.error(err);
      process.exit(1);
    }
  }

  if (count === 0) {
    console.log('✨ Database is already up to date.');
  } else {
    console.log(`\n🎉 Successfully applied ${count} migrations.`);
  }

  // 5. Seed default admin requested by user
  try {
    const adminCount = await sql`SELECT COUNT(*) as c FROM admins WHERE username = 'omux'`;
    if (Number(adminCount[0].c) === 0) {
      console.log('🔒 "omux" admin not found. Creating it...');
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.default.hash('2525', 10);
      await sql`INSERT INTO admins (username, password_hash) VALUES ('omux', ${hash})`;
      console.log('✅ Default admin created. (username: omux, password: ***)');
    }
  } catch (err) {
    console.error('Failed to seed default admin:', err);
  }
}

migrate().catch(err => {
  console.error('💥 Migration runner failed:');
  console.error(err);
  process.exit(1);
});
