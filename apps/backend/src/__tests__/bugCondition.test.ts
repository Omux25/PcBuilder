// @ts-nocheck
/**
 * Bug Condition Exploration Tests — Property 1
 *
 * These tests MUST FAIL on unfixed code — failure confirms the bugs exist.
 * After all fixes are applied, these tests MUST PASS.
 *
 * import.meta.dirname = backend/src/__tests__/
 * Paths:
 *   ../../routes/admin/   → backend/src/routes/admin/
 *   ../../routes/         → backend/src/routes/
 *   ../../db/             → backend/src/db/
 *   ../../db/migrations/  → backend/src/db/migrations/
 *   ../../app.ts          → backend/src/app.ts
 *   ../../../scraper/     → backend/scraper/
 */

import { describe, test, expect } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ── Issue 5: Scraper registry IDs ────────────────────────────────────────────

describe('Bug Condition: Scraper registry IDs match actual retailer IDs', () => {
  test('UltraPC is registered with id 10 (actual DB retailer ID)', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../../scraper/session.ts'),
      'utf-8'
    );
    expect(src).toMatch(/\{\s*id:\s*10\s*,\s*name:\s*['"]UltraPC['"]/);
  });

  test('NextLevel PC is registered with id 11 (actual DB retailer ID)', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../../scraper/session.ts'),
      'utf-8'
    );
    expect(src).toMatch(/\{\s*id:\s*11\s*,\s*name:\s*['"]NextLevel PC['"]/);
  });

  test('SetupGame is registered with id 13 (actual DB retailer ID)', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../../scraper/session.ts'),
      'utf-8'
    );
    expect(src).toMatch(/\{\s*id:\s*13\s*,\s*name:\s*['"]SetupGame['"]/);
  });

  test('SCRAPER_REGISTRY contains exactly 3 production scrapers', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../../scraper/session.ts'),
      'utf-8'
    );
    // Placeholder scrapers (site1, site2) were deleted in Round 2.
    // The registry should only contain the 3 real production scrapers.
    const matches = src.match(/\{\s*id:\s*\d+\s*,\s*name:/g) ?? [];
    expect(matches.length).toBe(3);
  });
});

// ── Issue 3: Duplicate migration prefix ──────────────────────────────────────

describe('Bug Condition: Migration files have unique numeric prefixes', () => {
  test('no two migration files share the same numeric prefix', async () => {
    const migrationsDir = join(import.meta.dirname, '../db/migrations');
    const files = await readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql'));
    const prefixes = sqlFiles.map(f => f.match(/^(\d+)_/)?.[1]).filter(Boolean);
    const uniquePrefixes = new Set(prefixes);
    expect(prefixes.length).toBe(uniquePrefixes.size);
  });

  test('original 015_add_benchmark_score.sql still exists', async () => {
    const migrationsDir = join(import.meta.dirname, '../db/migrations');
    const files = await readdir(migrationsDir);
    expect(files).toContain('015_add_benchmark_score.sql');
  });

  test('016_fix_ram_types_encoding.sql exists (renamed from 015)', async () => {
    const migrationsDir = join(import.meta.dirname, '../db/migrations');
    const files = await readdir(migrationsDir);
    expect(files).toContain('016_fix_ram_types_encoding.sql');
  });

  test('017_add_trigram_index.sql exists (renamed from 016)', async () => {
    const migrationsDir = join(import.meta.dirname, '../db/migrations');
    const files = await readdir(migrationsDir);
    expect(files).toContain('017_add_trigram_index.sql');
  });

  test('018_hash_refresh_tokens.sql exists (renamed from 017)', async () => {
    const migrationsDir = join(import.meta.dirname, '../db/migrations');
    const files = await readdir(migrationsDir);
    expect(files).toContain('018_hash_refresh_tokens.sql');
  });
});

// ── Issue 4: DI bypass in admin routes ───────────────────────────────────────

describe('Bug Condition: Admin routes use getSql() not direct bun sql import', () => {
  test('admin/logs.ts does NOT import sql directly from bun', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../routes/admin/logs.ts'),
      'utf-8'
    );
    expect(src).not.toContain("import { sql } from 'bun'");
  });

  test('admin/logs.ts imports getSql from db/index', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../routes/admin/logs.ts'),
      'utf-8'
    );
    expect(src).toContain('getSql');
  });

  test('admin/unmatched.ts does NOT import sql directly from bun', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../routes/admin/unmatched.ts'),
      'utf-8'
    );
    expect(src).not.toContain("import { sql } from 'bun'");
  });

  test('admin/unmatched.ts imports getSql from db/index', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../routes/admin/unmatched.ts'),
      'utf-8'
    );
    expect(src).toContain('getSql');
  });
});

// ── Issue 1 & 2: Dead route files deleted ────────────────────────────────────

describe('Bug Condition: Dead route files do not exist', () => {
  test('backend/src/routes/smartSearch.ts does not exist', async () => {
    const routesDir = join(import.meta.dirname, '../routes');
    const files = await readdir(routesDir);
    expect(files).not.toContain('smartSearch.ts');
  });

  test('backend/src/routes/prices.ts does not exist', async () => {
    const routesDir = join(import.meta.dirname, '../routes');
    const files = await readdir(routesDir);
    expect(files).not.toContain('prices.ts');
  });
});

// ── Issue 6: temp_migrate.ts deleted ─────────────────────────────────────────

describe('Bug Condition: Stale files do not exist', () => {
  test('backend/src/db/temp_migrate.ts does not exist', async () => {
    const dbDir = join(import.meta.dirname, '../db');
    const files = await readdir(dbDir);
    expect(files).not.toContain('temp_migrate.ts');
  });
});

// ── Issue 10: Broken transaction wrapper removed ──────────────────────────────

describe('Bug Condition: Bulk import has no broken sql.begin() wrapper', () => {
  test('admin/components.ts import handler does not use sql.begin()', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../routes/admin/components.ts'),
      'utf-8'
    );
    expect(src).not.toContain('sql.begin(');
  });

  test('admin/components.ts does not import SqlFn type (only used by broken wrapper)', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../routes/admin/components.ts'),
      'utf-8'
    );
    expect(src).not.toContain('import type { SqlFn }');
  });
});

// ── New issues: compatibility schema gaps ─────────────────────────────────────

describe('Bug Condition: coolingSchema and caseSchema include compatibility fields', () => {
  test('coolingSchema includes height_mm field', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../schemas/componentSchemas.ts'),
      'utf-8'
    );
    expect(src).toContain('height_mm');
  });

  test('caseSchema includes supported_motherboards field', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../schemas/componentSchemas.ts'),
      'utf-8'
    );
    expect(src).toContain('supported_motherboards');
  });

  test('caseSchema includes max_cooler_height_mm field', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../schemas/componentSchemas.ts'),
      'utf-8'
    );
    expect(src).toContain('max_cooler_height_mm');
  });
});

// ── New issues: PSU excluded from TDP sum ─────────────────────────────────────

describe('Bug Condition: PSU is excluded from TDP calculation', () => {
  test('compatibilityService TDP sum does not include psu key', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../services/compatibilityService.ts'),
      'utf-8'
    );
    // The componentKeys array for TDP must NOT include 'psu'
    // It should be: ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'case', 'cooling']
    expect(src).not.toMatch(/componentKeys\s*=\s*\[.*'psu'.*\]\s*as const/);
  });
});

// ── New issues: placeholder scrapers deleted ──────────────────────────────────

describe('Bug Condition: Placeholder scraper files do not exist', () => {
  test('site1Scraper.ts does not exist', async () => {
    const scrapersDir = join(import.meta.dirname, '../../scraper/scrapers');
    const files = await readdir(scrapersDir);
    expect(files).not.toContain('site1Scraper.ts');
  });

  test('site2Scraper.ts does not exist', async () => {
    const scrapersDir = join(import.meta.dirname, '../../scraper/scrapers');
    const files = await readdir(scrapersDir);
    expect(files).not.toContain('site2Scraper.ts');
  });
});

// ── New issues: createPreset is transactional ─────────────────────────────────

describe('Bug Condition: createPreset uses a transaction', () => {
  test('presetService.ts createPreset uses sql.begin()', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../services/presetService.ts'),
      'utf-8'
    );
    expect(src).toContain('sql.begin(');
  });
});

// ── New issues: parseId helper extracted ─────────────────────────────────────

describe('Bug Condition: parseId helper exists in admin/types.ts', () => {
  test('admin/types.ts exports parseId function', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../routes/admin/types.ts'),
      'utf-8'
    );
    // parseId is defined in utils/errors.ts and re-exported from admin/types.ts
    // so admin routes only need one import. Check that it is exported from here.
    expect(src).toContain('parseId');
  });

  test('parseId is defined in utils/errors.ts', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../utils/errors.ts'),
      'utf-8'
    );
    expect(src).toContain('export function parseId');
  });
});
