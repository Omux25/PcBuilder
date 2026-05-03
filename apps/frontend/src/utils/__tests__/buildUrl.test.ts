// @ts-nocheck — runs in Bun (WSL2); bun:test types not available on Windows
import { describe, test, expect } from 'bun:test';
import {
  encodeBuildToUrl,
  decodeBuildFromUrl,
  saveBuildToStorage,
  loadBuildFromStorage,
  clearBuildStorage,
} from '../buildUrl';
import type { BuildConfig } from '../../types';

// ── Minimal component stub ────────────────────────────────────────────────────

function makeComponent(id: number, category: string) {
  return {
    id,
    slug: `component-${id}`,
    name: `Component ${id}`,
    category,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

// ── encodeBuildToUrl ──────────────────────────────────────────────────────────

describe('encodeBuildToUrl', () => {
  test('encodes a single component', () => {
    const build: BuildConfig = { cpu: makeComponent(42, 'cpu') as any };
    const qs = encodeBuildToUrl(build);
    expect(qs).toContain('cpu=42');
  });

  test('encodes multiple single-slot components', () => {
    const build: BuildConfig = {
      cpu: makeComponent(1, 'cpu') as any,
      gpu: makeComponent(2, 'gpu') as any,
      psu: makeComponent(3, 'psu') as any,
    };
    const qs = encodeBuildToUrl(build);
    expect(qs).toContain('cpu=1');
    expect(qs).toContain('gpu=2');
    expect(qs).toContain('psu=3');
  });

  test('encodes indexed RAM slots', () => {
    const build: BuildConfig = {
      ram_1: makeComponent(10, 'ram') as any,
      ram_2: makeComponent(11, 'ram') as any,
    };
    const qs = encodeBuildToUrl(build);
    expect(qs).toContain('ram_1=10');
    expect(qs).toContain('ram_2=11');
  });

  test('encodes indexed storage slots', () => {
    const build: BuildConfig = {
      storage_1: makeComponent(20, 'storage') as any,
      storage_2: makeComponent(21, 'storage') as any,
    };
    const qs = encodeBuildToUrl(build);
    expect(qs).toContain('storage_1=20');
    expect(qs).toContain('storage_2=21');
  });

  test('encodes legacy bare ram key (backwards compat)', () => {
    const build: BuildConfig = {
      ram: makeComponent(5, 'ram') as any,
    };
    const qs = encodeBuildToUrl(build);
    expect(qs).toContain('ram=5');
  });

  test('returns empty string for empty build', () => {
    expect(encodeBuildToUrl({})).toBe('');
  });

  test('only includes keys that are set', () => {
    const build: BuildConfig = { cpu: makeComponent(5, 'cpu') as any };
    const qs = encodeBuildToUrl(build);
    expect(qs).not.toContain('gpu=');
    expect(qs).not.toContain('ram_1=');
  });

  test('encoded string can be parsed back by URLSearchParams', () => {
    const build: BuildConfig = {
      cpu: makeComponent(10, 'cpu') as any,
      motherboard: makeComponent(20, 'motherboard') as any,
    };
    const qs = encodeBuildToUrl(build);
    const params = new URLSearchParams(qs);
    expect(params.get('cpu')).toBe('10');
    expect(params.get('motherboard')).toBe('20');
  });
});

// ── decodeBuildFromUrl ────────────────────────────────────────────────────────

describe('decodeBuildFromUrl', () => {
  test('decodes a single component ID', () => {
    const result = decodeBuildFromUrl('?cpu=42');
    expect(result.cpu).toBe(42);
  });

  test('decodes multiple single-slot component IDs', () => {
    const result = decodeBuildFromUrl('?cpu=1&gpu=2&psu=3');
    expect(result.cpu).toBe(1);
    expect(result.gpu).toBe(2);
    expect(result.psu).toBe(3);
  });

  test('decodes indexed RAM slots', () => {
    const result = decodeBuildFromUrl('?ram_1=10&ram_2=11');
    expect(result.ram_1).toBe(10);
    expect(result.ram_2).toBe(11);
  });

  test('decodes indexed storage slots', () => {
    const result = decodeBuildFromUrl('?storage_1=20&storage_2=21');
    expect(result.storage_1).toBe(20);
    expect(result.storage_2).toBe(21);
  });

  test('decodes legacy bare ram key (backwards compat)', () => {
    const result = decodeBuildFromUrl('?ram=5');
    expect(result.ram).toBe(5);
  });

  test('decodes legacy bare storage key (backwards compat)', () => {
    const result = decodeBuildFromUrl('?storage=7');
    expect(result.storage).toBe(7);
  });

  test('returns empty object for empty search string', () => {
    expect(decodeBuildFromUrl('')).toEqual({});
  });

  test('ignores unknown keys', () => {
    const result = decodeBuildFromUrl('?cpu=1&unknown=99');
    expect(result.cpu).toBe(1);
    expect(result.unknown).toBeUndefined();
  });

  test('ignores non-numeric values', () => {
    const result = decodeBuildFromUrl('?cpu=abc');
    expect(result.cpu).toBeUndefined();
  });

  test('round-trips with encodeBuildToUrl — single-slot', () => {
    const build: BuildConfig = {
      cpu: makeComponent(7, 'cpu') as any,
      psu: makeComponent(99, 'psu') as any,
    };
    const qs = encodeBuildToUrl(build);
    const decoded = decodeBuildFromUrl(`?${qs}`);
    expect(decoded.cpu).toBe(7);
    expect(decoded.psu).toBe(99);
  });

  test('round-trips with encodeBuildToUrl — multi-slot RAM and storage', () => {
    const build: BuildConfig = {
      cpu: makeComponent(1, 'cpu') as any,
      ram_1: makeComponent(10, 'ram') as any,
      ram_2: makeComponent(11, 'ram') as any,
      storage_1: makeComponent(20, 'storage') as any,
      storage_2: makeComponent(21, 'storage') as any,
    };
    const qs = encodeBuildToUrl(build);
    const decoded = decodeBuildFromUrl(`?${qs}`);
    expect(decoded.cpu).toBe(1);
    expect(decoded.ram_1).toBe(10);
    expect(decoded.ram_2).toBe(11);
    expect(decoded.storage_1).toBe(20);
    expect(decoded.storage_2).toBe(21);
  });
});

// ── localStorage helpers ──────────────────────────────────────────────────────
// Bun doesn't have a DOM/localStorage — these functions handle missing
// localStorage gracefully (try/catch). We test the graceful fallback.

describe('loadBuildFromStorage', () => {
  test('returns empty object when localStorage is unavailable', () => {
    const result = loadBuildFromStorage();
    expect(result).toEqual({});
  });
});

describe('saveBuildToStorage / clearBuildStorage', () => {
  test('does not throw when localStorage is unavailable', () => {
    const build: BuildConfig = { cpu: makeComponent(1, 'cpu') as any };
    expect(() => saveBuildToStorage(build)).not.toThrow();
    expect(() => clearBuildStorage()).not.toThrow();
  });
});
