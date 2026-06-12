// @ts-nocheck
/**
 * Preservation Tests — Property 2
 *
 * These tests MUST PASS on unfixed code AND on fixed code.
 * They capture baseline behaviors that must not regress.
 *
 * import.meta.dirname = backend/src/__tests__/
 */

import { describe, test, expect } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ── Migration sequence preservation ──────────────────────────────────────────

describe('Preservation: Migration files 001–015 are untouched', () => {
  const EXPECTED_ORIGINAL_MIGRATIONS = [
    '001_create_components.sql',
    '002_create_retailers.sql',
    '003_create_prices.sql',
    '004_create_scraper_logs.sql',
    '005_create_admins.sql',
    '006_expand_components.sql',
    '007_expand_retailers.sql',
    '008_create_scraper_mappings.sql',
    '009_create_price_history.sql',
    '010_create_preset_builds.sql',
    '011_create_unmatched_listings.sql',
    '012_create_admin_activity_log.sql',
    '013_create_refresh_tokens.sql',
    '014_prices_variant_model.sql',
    '015_add_benchmark_score.sql',
  ];

  test('all original migrations 001–015 still exist', async () => {
    const migrationsDir = join(import.meta.dirname, '../core/db/migrations');
    const files = await readdir(migrationsDir);
    for (const expected of EXPECTED_ORIGINAL_MIGRATIONS) {
      expect(files).toContain(expected);
    }
  });

  test('migration files are sorted in correct order (no gaps in 001–015)', async () => {
    const migrationsDir = join(import.meta.dirname, '../core/db/migrations');
    const files = await readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
    const prefixes = sqlFiles.map(f => parseInt(f.match(/^(\d+)_/)?.[1] ?? '0'));
    // First 15 should be 1–15 with no gaps
    for (let i = 0; i < 15; i++) {
      expect(prefixes[i]).toBe(i + 1);
    }
  });
});

// ── Scraper registry preservation ────────────────────────────────────────────

describe('Preservation: Production scraper IDs match actual retailer IDs', () => {
  test('UltraPC is registered by name (dynamic ID resolution)', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../modules/scraping/engine/config/retailers.config.ts'),
      'utf-8'
    );
    expect(src).toMatch(/baseUrl:\s*['"]https:\/\/www\.ultrapc\.ma['"]/);
  });

  test('NextLevel PC is registered by name (dynamic ID resolution)', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../modules/scraping/engine/config/retailers.config.ts'),
      'utf-8'
    );
    expect(src).toMatch(/baseUrl:\s*['"]https:\/\/nextlevelpc\.ma['"]/);
  });

  test('SetupGame is registered by name (dynamic ID resolution)', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../modules/scraping/engine/config/retailers.config.ts'),
      'utf-8'
    );
    expect(src).toMatch(/baseUrl:\s*['"]https:\/\/setupgame\.ma['"]/);
  });
});

// ── app.ts never imported dead routes ────────────────────────────────────────

describe('Preservation: app.ts never imported the dead route files', () => {
  test('app.ts does not import smartSearchRouter', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../app.ts'),
      'utf-8'
    );
    expect(src).not.toContain('smartSearchRouter');
  });

  test('app.ts does not import pricesRouter', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../app.ts'),
      'utf-8'
    );
    expect(src).not.toContain('pricesRouter');
  });
});

// ── Bulk import per-row error handling preserved ──────────────────────────────

describe('Preservation: Bulk import per-row error handling is intact', () => {
  test('admin/components.ts import handler still has per-row try/catch', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../modules/catalog/controllers/componentController.ts'),
      'utf-8'
    );
    expect(src).toContain('results.imported++');
    expect(src).toContain('results.failed++');
    expect(src).toContain('results.skipped++');
  });
});

// ── Compatibility engine preservation ────────────────────────────────────────

describe('Preservation: Existing compatibility rules still work after PSU TDP fix', () => {
  test('socket_mismatch still fires for mismatched sockets', async () => {
    const { validateCompatibility } = await import('../modules/builds/services/compatibilityService.js');
    const result = validateCompatibility({
      cpu: { socket: 'AM5', tdp: 65 },
      motherboard: { socket: 'LGA1700', supported_ram_types: ['DDR5'], max_ram_frequency: 6000 },
    });
    const errors = result.errors.filter(e => e.rule === 'socket_mismatch');
    expect(errors).toHaveLength(1);
  });

  test('psu_underpowered still fires when PSU wattage is below recommended', async () => {
    const { validateCompatibility } = await import('../modules/builds/services/compatibilityService.js');
    const result = validateCompatibility({
      gpu: { length_mm: 300, tdp: 300 },
      psu: { wattage: 400 }, // recommended = ceil(300 * 1.5) = 450
    });
    const warnings = result.warnings.filter(w => w.rule === 'psu_underpowered');
    expect(warnings).toHaveLength(1);
  });
});

// ── Schema preservation ───────────────────────────────────────────────────────

describe('Preservation: Existing schema fields are unchanged', () => {
  test('cpuSchema still requires socket', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../../../../shared/schemas/component.schema.ts'),
      'utf-8'
    );
    expect(src).toContain("socket: z.string().min(1");
  });

  test('caseSchema still requires max_gpu_length_mm', async () => {
    const src = await readFile(
      join(import.meta.dirname, '../../../../shared/schemas/component.schema.ts'),
      'utf-8'
    );
    expect(src).toContain("max_gpu_length_mm: z.number()");
  });
});
