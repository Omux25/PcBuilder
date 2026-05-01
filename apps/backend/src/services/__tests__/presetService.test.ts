/**
 * Unit tests for presetService.ts
 * Injects a mock SQL executor via setSql() so no real DB connection is needed.
 *
 * Note: createPreset() and updatePreset() use sql.begin() for transactions.
 * The mock SQL function must also expose a begin() method that calls the callback
 * with itself (simulating a transaction-scoped connection).
 */

// @ts-nocheck — this file runs in Bun (WSL2); bun:test types not available on Windows
import { describe, test, expect, afterAll } from 'bun:test';
import {
  getPresets,
  getPresetById,
  deletePreset,
} from '../presetService.js';
import { setSql, resetSql } from '../../db/index.js';

afterAll(() => resetSql());

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PRESET_ROW = {
  id: 1,
  name: 'Budget Gaming Build',
  description: 'Entry-level gaming PC',
  use_case: 'gaming',
  total_price_estimate: 8500,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_COMPONENT_ROWS = [
  {
    preset_build_id: 1,
    category: 'cpu',
    id: 10,
    slug: 'amd-ryzen-5-7600',
    name: 'Ryzen 5 7600',
    brand: 'AMD',
    image_url: null,
    is_active: true,
  },
  {
    preset_build_id: 1,
    category: 'gpu',
    id: 20,
    slug: 'rtx-4060',
    name: 'RTX 4060',
    brand: 'NVIDIA',
    image_url: null,
    is_active: true,
  },
];

// ── Mock SQL factory ─────────────────────────────────────────────────────────

/**
 * Creates a mock SQL function that returns different rows based on call order.
 * The first call returns `firstRows`, subsequent calls return `restRows`.
 */
function makeSequentialMockSql(...rowSets: unknown[][]) {
  let callIndex = 0;
  const fn = (_strings: TemplateStringsArray, ..._values: unknown[]) => {
    const rows = rowSets[callIndex] ?? rowSets[rowSets.length - 1];
    callIndex++;
    return Promise.resolve(rows);
  };
  // begin() calls the callback with the same mock (no real transaction needed in tests)
  fn.begin = async (cb: (tx: unknown) => Promise<unknown>) => cb(fn);
  return fn;
}

function makeMockSql(rows: unknown[]) {
  const fn = (_strings: TemplateStringsArray, ..._values: unknown[]) =>
    Promise.resolve(rows);
  fn.begin = async (cb: (tx: unknown) => Promise<unknown>) => cb(fn);
  return fn;
}

// ── getPresets ───────────────────────────────────────────────────────────────

describe('getPresets', () => {
  test('returns presets with their components', async () => {
    setSql(makeSequentialMockSql([MOCK_PRESET_ROW], MOCK_COMPONENT_ROWS));
    const result = await getPresets();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].name).toBe('Budget Gaming Build');
    expect(result[0].components).toHaveProperty('cpu');
    expect(result[0].components).toHaveProperty('gpu');
  });

  test('marks preset as incomplete when a component is inactive', async () => {
    const inactiveComponent = { ...MOCK_COMPONENT_ROWS[0], is_active: false };
    setSql(makeSequentialMockSql([MOCK_PRESET_ROW], [inactiveComponent, MOCK_COMPONENT_ROWS[1]]));
    const result = await getPresets();
    expect(result[0].incomplete).toBe(true);
  });

  test('marks preset as complete when all components are active', async () => {
    setSql(makeSequentialMockSql([MOCK_PRESET_ROW], MOCK_COMPONENT_ROWS));
    const result = await getPresets();
    expect(result[0].incomplete).toBe(false);
  });

  test('returns empty array when no presets exist', async () => {
    setSql(makeSequentialMockSql([], []));
    const result = await getPresets();
    expect(result).toHaveLength(0);
  });

  test('preset with no components has empty components map', async () => {
    setSql(makeSequentialMockSql([MOCK_PRESET_ROW], []));
    const result = await getPresets();
    expect(result[0].components).toEqual({});
    expect(result[0].incomplete).toBe(false);
  });
});

// ── getPresetById ────────────────────────────────────────────────────────────

describe('getPresetById', () => {
  test('returns the preset with components when found', async () => {
    setSql(makeSequentialMockSql([MOCK_PRESET_ROW], MOCK_COMPONENT_ROWS));
    const result = await getPresetById(1);
    expect(result.id).toBe(1);
    expect(result.components.cpu.name).toBe('Ryzen 5 7600');
    expect(result.components.gpu.name).toBe('RTX 4060');
  });

  test('throws PRESET_NOT_FOUND when preset does not exist', async () => {
    setSql(makeMockSql([]));
    let thrownError: Error | null = null;
    try {
      await getPresetById(9999);
    } catch (err) {
      thrownError = err as Error;
    }
    expect(thrownError).not.toBeNull();
    expect((thrownError as any).code).toBe('PRESET_NOT_FOUND');
    expect(thrownError!.message).toContain('9999');
  });
});

// ── deletePreset ─────────────────────────────────────────────────────────────

describe('deletePreset', () => {
  test('resolves without error when preset is deleted', async () => {
    setSql(makeMockSql([{ id: 1 }]));
    await expect(deletePreset(1)).resolves.toBeUndefined();
  });

  test('throws PRESET_NOT_FOUND when preset does not exist', async () => {
    setSql(makeMockSql([]));
    let thrownError: Error | null = null;
    try {
      await deletePreset(9999);
    } catch (err) {
      thrownError = err as Error;
    }
    expect(thrownError).not.toBeNull();
    expect((thrownError as any).code).toBe('PRESET_NOT_FOUND');
  });
});
