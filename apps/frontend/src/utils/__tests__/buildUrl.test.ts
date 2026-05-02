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

  test('encodes multiple components', () => {
    const build: BuildConfig = {
      cpu: makeComponent(1, 'cpu') as any,
      gpu: makeComponent(2, 'gpu') as any,
      ram: makeComponent(3, 'ram') as any,
    };
    const qs = encodeBuildToUrl(build);
    expect(qs).toContain('cpu=1');
    expect(qs).toContain('gpu=2');
    expect(qs).toContain('ram=3');
  });

  test('returns empty string for empty build', () => {
    expect(encodeBuildToUrl({})).toBe('');
  });

  test('only includes categories that are set', () => {
    const build: BuildConfig = { cpu: makeComponent(5, 'cpu') as any };
    const qs = encodeBuildToUrl(build);
    expect(qs).not.toContain('gpu=');
    expect(qs).not.toContain('ram=');
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

  test('decodes multiple component IDs', () => {
    const result = decodeBuildFromUrl('?cpu=1&gpu=2&ram=3');
    expect(result.cpu).toBe(1);
    expect(result.gpu).toBe(2);
    expect(result.ram).toBe(3);
  });

  test('returns empty object for empty search string', () => {
    expect(decodeBuildFromUrl('')).toEqual({});
  });

  test('ignores unknown category keys', () => {
    const result = decodeBuildFromUrl('?cpu=1&unknown=99');
    expect(result.cpu).toBe(1);
    expect(result.unknown).toBeUndefined();
  });

  test('ignores non-numeric values', () => {
    const result = decodeBuildFromUrl('?cpu=abc');
    expect(result.cpu).toBeUndefined();
  });

  test('round-trips with encodeBuildToUrl', () => {
    const build: BuildConfig = {
      cpu: makeComponent(7, 'cpu') as any,
      psu: makeComponent(99, 'psu') as any,
    };
    const qs = encodeBuildToUrl(build);
    const decoded = decodeBuildFromUrl(`?${qs}`);
    expect(decoded.cpu).toBe(7);
    expect(decoded.psu).toBe(99);
  });
});

// ── localStorage helpers ──────────────────────────────────────────────────────
// Bun doesn't have a DOM/localStorage — these functions handle missing
// localStorage gracefully (try/catch). We test the graceful fallback.

describe('loadBuildFromStorage', () => {
  test('returns empty object when localStorage is unavailable', () => {
    // In Bun test environment, localStorage is not defined
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
