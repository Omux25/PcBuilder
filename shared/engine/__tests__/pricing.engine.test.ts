import { describe, it, expect } from 'bun:test';
import { calculateBuildTotalPrice } from '../pricing.engine.js';
import type { BuildConfig, Component } from '../../types.js';

describe('Pricing Engine', () => {
  describe('calculateBuildTotalPrice', () => {
    it('should return 0 for an empty build', () => {
      const build: BuildConfig = {};
      const total = calculateBuildTotalPrice(build);
      expect(total).toBe(0);
    });

    it('should return 0 when components have no lowest_price', () => {
      const build: BuildConfig = {
        cpu: { id: 1, name: 'CPU', is_active: true } as Component,
        gpu: { id: 2, name: 'GPU', is_active: true } as Component,
      };
      const total = calculateBuildTotalPrice(build);
      expect(total).toBe(0);
    });

    it('should return the correct sum for components with valid lowest_price', () => {
      const build: BuildConfig = {
        cpu: { id: 1, name: 'CPU', is_active: true, lowest_price: 1500 } as unknown as Component,
        gpu: { id: 2, name: 'GPU', is_active: true, lowest_price: 4500 } as unknown as Component,
        ram: { id: 3, name: 'RAM', is_active: true, lowest_price: 800 } as unknown as Component,
      };
      const total = calculateBuildTotalPrice(build);
      expect(total).toBe(6800);
    });

    it('should ignore components where lowest_price is null, undefined, or 0', () => {
      const build: BuildConfig = {
        cpu: { id: 1, name: 'CPU', is_active: true, lowest_price: 2000 } as unknown as Component,
        gpu: { id: 2, name: 'GPU', is_active: true, lowest_price: null } as unknown as Component,
        ram: { id: 3, name: 'RAM', is_active: true, lowest_price: undefined } as unknown as Component,
        storage: { id: 4, name: 'SSD', is_active: true, lowest_price: 0 } as unknown as Component,
      };
      const total = calculateBuildTotalPrice(build);
      expect(total).toBe(2000);
    });

    it('should handle undefined or null component entries gracefully', () => {
      const build: BuildConfig = {
        cpu: { id: 1, name: 'CPU', is_active: true, lowest_price: 1500 } as unknown as Component,
        gpu: undefined,
        ram: null as unknown as Component,
      };
      const total = calculateBuildTotalPrice(build);
      expect(total).toBe(1500);
    });
  });
});
