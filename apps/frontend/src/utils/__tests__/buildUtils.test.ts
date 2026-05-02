// @ts-nocheck — runs in Bun (WSL2); bun:test types not available on Windows
import { describe, test, expect } from 'bun:test';
import { calculateBuildTotalPrice } from '../buildUtils';
import type { BuildConfig } from '../../types';

function makeComponent(id: number, category: string, lowest_price: number | null = null) {
  return {
    id,
    slug: `component-${id}`,
    name: `Component ${id}`,
    category,
    is_active: true,
    lowest_price,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
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
      ram: makeComponent(3, 'ram', 500) as any,
    };
    expect(calculateBuildTotalPrice(build)).toBe(2699);
  });

  test('handles a full 8-component build', () => {
    const build: BuildConfig = {
      cpu:        makeComponent(1, 'cpu',        2199) as any,
      motherboard:makeComponent(2, 'motherboard', 899) as any,
      gpu:        makeComponent(3, 'gpu',        4299) as any,
      ram:        makeComponent(4, 'ram',         499) as any,
      storage:    makeComponent(5, 'storage',     699) as any,
      psu:        makeComponent(6, 'psu',         599) as any,
      case:       makeComponent(7, 'case',        799) as any,
      cooling:    makeComponent(8, 'cooling',     349) as any,
    };
    expect(calculateBuildTotalPrice(build)).toBe(10342);
  });

  test('returns 0 when all prices are 0', () => {
    const build: BuildConfig = {
      cpu: makeComponent(1, 'cpu', 0) as any,
    };
    // price of 0 is falsy — treated as no price
    expect(calculateBuildTotalPrice(build)).toBe(0);
  });
});
