// @ts-nocheck — runs in Bun (WSL2); bun:test types not available on Windows
import { describe, test, expect } from 'bun:test';
import { calculateBuildTotalPrice } from '@shared/engine/pricing.engine';
import { getConfiguratorSlots } from '@shared/engine/build.engine';
import type { BuildConfig } from '../../types';

function makeComponent(id: number, category: string, lowest_price: number | null = null, extra: Record<string, unknown> = {}) {
  return {
    id,
    slug: `component-${id}`,
    name: `Component ${id}`,
    category,
    is_active: true,
    lowest_price,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...extra,
  };
}

describe('calculateBuildTotalPrice', () => {
  test('returns 0 for empty build', () => {
    expect(calculateBuildTotalPrice({})).toBe(0);
  });

  test('returns 0 when no components have prices', () => {
    const build: BuildConfig = {
      cpu: makeComponent(1, 'cpu', null) as any,
      gpu: makeComponent(2, 'gpu', null) as any,
    };
    expect(calculateBuildTotalPrice(build)).toBe(0);
  });

  test('sums prices of components that have them', () => {
    const build: BuildConfig = {
      cpu: makeComponent(1, 'cpu', 2199) as any,
      gpu: makeComponent(2, 'gpu', 4299) as any,
    };
    expect(calculateBuildTotalPrice(build)).toBe(6498);
  });

  test('skips components with null price', () => {
    const build: BuildConfig = {
      cpu: makeComponent(1, 'cpu', 2199) as any,
      gpu: makeComponent(2, 'gpu', null) as any,
      ram_1: makeComponent(3, 'ram', 500) as any,
    };
    expect(calculateBuildTotalPrice(build)).toBe(2699);
  });

  test('sums multi-slot RAM and storage', () => {
    const build: BuildConfig = {
      cpu: makeComponent(1, 'cpu', 2199) as any,
      ram_1: makeComponent(2, 'ram', 499) as any,
      ram_2: makeComponent(3, 'ram', 499) as any,
      storage_1: makeComponent(4, 'storage', 699) as any,
      storage_2: makeComponent(5, 'storage', 399) as any,
    };
    expect(calculateBuildTotalPrice(build)).toBe(2199 + 499 + 499 + 699 + 399);
  });

  test('handles a full 8-component build with single-slot keys', () => {
    const build: BuildConfig = {
      cpu: makeComponent(1, 'cpu', 2199) as any,
      motherboard: makeComponent(2, 'motherboard', 899) as any,
      gpu: makeComponent(3, 'gpu', 4299) as any,
      ram_1: makeComponent(4, 'ram', 499) as any,
      storage_1: makeComponent(5, 'storage', 699) as any,
      psu: makeComponent(6, 'psu', 599) as any,
      case: makeComponent(7, 'case', 799) as any,
      cooling: makeComponent(8, 'cooling', 349) as any,
    };
    expect(calculateBuildTotalPrice(build)).toBe(10342);
  });

  test('returns 0 when all prices are 0 (falsy)', () => {
    const build: BuildConfig = {
      cpu: makeComponent(1, 'cpu', 0) as any,
    };
    expect(calculateBuildTotalPrice(build)).toBe(0);
  });
});

describe('getConfiguratorSlots', () => {
  test('returns no RAM or storage slots when build is empty (PCPartPicker style)', () => {
    const slots = getConfiguratorSlots({});
    // No pre-generated empty slots — only filled slots appear
    expect(slots).not.toContain('ram_1');
    expect(slots).not.toContain('ram_2');
    expect(slots).not.toContain('storage_1');
    expect(slots).not.toContain('storage_2');
  });

  test('returns only filled RAM slots — not all motherboard slots', () => {
    const build: BuildConfig = {
      motherboard: makeComponent(1, 'motherboard', null, { ram_slots: 4 }) as any,
      ram_1: makeComponent(2, 'ram', 499) as any,
    };
    const slots = getConfiguratorSlots(build);
    // Only ram_1 is filled — ram_2/3/4 should NOT appear
    expect(slots).toContain('ram_1');
    expect(slots).not.toContain('ram_2');
    expect(slots).not.toContain('ram_3');
    expect(slots).not.toContain('ram_4');
  });

  test('returns all filled RAM slots regardless of motherboard slot count', () => {
    const build: BuildConfig = {
      motherboard: makeComponent(1, 'motherboard', null, { ram_slots: 4 }) as any,
      ram_1: makeComponent(2, 'ram', 499) as any,
      ram_2: makeComponent(3, 'ram', 499) as any,
      ram_3: makeComponent(4, 'ram', 499) as any,
    };
    const slots = getConfiguratorSlots(build);
    expect(slots).toContain('ram_1');
    expect(slots).toContain('ram_2');
    expect(slots).toContain('ram_3');
    expect(slots).not.toContain('ram_4');
  });

  test('returns correct filled storage slots', () => {
    const build: BuildConfig = {
      motherboard: makeComponent(1, 'motherboard', null, { m2_slots: 2, sata_ports: 4 }) as any,
      storage_1: makeComponent(2, 'storage', 699) as any,
      storage_2: makeComponent(3, 'storage', 399) as any,
    };
    const slots = getConfiguratorSlots(build);
    expect(slots).toContain('storage_1');
    expect(slots).toContain('storage_2');
    expect(slots).not.toContain('storage_3');
  });

  test('single-slot categories appear exactly once', () => {
    const slots = getConfiguratorSlots({});
    for (const cat of ['cpu', 'motherboard', 'gpu', 'psu', 'case', 'cooling']) {
      expect(slots.filter(s => s === cat)).toHaveLength(1);
    }
  });

  test('does not include bare ram or storage keys', () => {
    const slots = getConfiguratorSlots({});
    expect(slots).not.toContain('ram');
    expect(slots).not.toContain('storage');
  });
});
