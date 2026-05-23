// @ts-nocheck
import { describe, test, expect, it } from 'bun:test';
import { formatComponentName } from '@shared/formatting/component-name.formatter';

// Minimal Component factory
function make(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: 'test',
    name: 'Test Component',
    brand: 'BrandX',
    category: 'cpu',
    is_active: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  };
}

describe('formatComponentName — Base Rules', () => {
  it('returns Unknown Component if name is missing', () => {
    expect(formatComponentName({})).toBe('Unknown Component');
  });

  it('prepends brand if not present in the model name', () => {
    const c = make({ brand: 'AMD', name: 'Ryzen 5 7600X' });
    expect(formatComponentName(c)).toBe('AMD Ryzen 5 7600X');
  });

  it('does not duplicate brand if already present in the model name', () => {
    const c = make({ brand: 'Intel', name: 'Intel Core i5-13600K' });
    expect(formatComponentName(c)).toBe('Intel Core i5-13600K');
  });

  it('excludes brand when excludeBrand option is true', () => {
    const c = make({ brand: 'MSI', name: 'MAG B650 TOMAHAWK WIFI', category: 'motherboard' });
    expect(formatComponentName(c, { excludeBrand: true })).toBe('MAG B650 TOMAHAWK WIFI');
  });
});

describe('formatComponentName — CPU', () => {
  it('does not append any extra fields for CPU', () => {
    const c = make({ brand: 'Intel', name: 'Core i9-14900K', category: 'cpu', socket: 'LGA1700' });
    expect(formatComponentName(c)).toBe('Intel Core i9-14900K');
  });
});

describe('formatComponentName — GPU', () => {
  it('appends chipset and vram if not in model name', () => {
    const c = make({
      brand: 'ASUS',
      name: 'ROG Strix RTX 4070 Ti',
      category: 'gpu',
      chipset: 'RTX 4070 Ti',
      vram_gb: 12,
    });
    // RTX 4070 Ti is already in ROG Strix RTX 4070 Ti, but 12GB is not.
    expect(formatComponentName(c)).toBe('ASUS ROG Strix RTX 4070 Ti 12GB');
  });

  it('appends both chipset and vram if neither in model name', () => {
    const c = make({
      brand: 'MSI',
      name: 'Gaming X Slim',
      category: 'gpu',
      chipset: 'GeForce RTX 4070',
      vram_gb: 12,
    });
    expect(formatComponentName(c)).toBe('MSI Gaming X Slim GeForce RTX 4070 12GB');
  });
});

describe('formatComponentName — RAM', () => {
  it('formats capacity and kit count properly without duplicate specs', () => {
    const c = make({
      brand: 'Corsair',
      name: 'Vengeance RGB',
      category: 'ram',
      capacity_gb: 32,
      kit_count: 2,
      ram_type: 'DDR5',
      frequency_mhz: 6000,
      cas_latency: 30,
    });
    expect(formatComponentName(c)).toBe('Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000MHz CL30');
  });

  it('handles single stick RAM capacity without kit details', () => {
    const c = make({
      brand: 'Crucial',
      name: 'Classic',
      category: 'ram',
      capacity_gb: 16,
      kit_count: 1,
      ram_type: 'DDR4',
      frequency_mhz: 3200,
      cas_latency: 22,
    });
    expect(formatComponentName(c)).toBe('Crucial Classic 16GB DDR4 3200MHz CL22');
  });

  it('does not duplicate latency if clxx / cxx or just the number is present', () => {
    const c1 = make({
      brand: 'G.Skill',
      name: 'Trident Z5 CL30',
      category: 'ram',
      cas_latency: 30,
    });
    expect(formatComponentName(c1)).toBe('G.Skill Trident Z5 CL30');

    const c2 = make({
      brand: 'G.Skill',
      name: 'Trident Z5 C40',
      category: 'ram',
      cas_latency: 40,
    });
    expect(formatComponentName(c2)).toBe('G.Skill Trident Z5 C40');
  });
});

describe('formatComponentName — Storage', () => {
  it('formats storage capacity in TB if >= 1000', () => {
    const c = make({
      brand: 'Samsung',
      name: '990 Pro',
      category: 'storage',
      capacity_gb: 2000,
      interface_type: 'PCIe 4.0 x4',
    });
    expect(formatComponentName(c)).toBe('Samsung 990 Pro 2TB PCIe 4.0 x4');
  });

  it('formats storage capacity in GB if < 1000', () => {
    const c = make({
      brand: 'Samsung',
      name: '990 Pro',
      category: 'storage',
      capacity_gb: 500,
      interface_type: 'PCIe 4.0 x4',
    });
    expect(formatComponentName(c)).toBe('Samsung 990 Pro 500GB PCIe 4.0 x4');
  });
});

describe('formatComponentName — PSU', () => {
  it('handles modularity, efficiency and wattage formatting without duplicate text', () => {
    const c = make({
      brand: 'Corsair',
      name: 'RM850x Shift',
      category: 'psu',
      wattage: 850,
      efficiency_rating: 'Gold',
      modular: 'Full',
    });
    expect(formatComponentName(c)).toBe('Corsair RM850x Shift 850W Gold Full Modular');
  });

  it('does not append non-modular labels or duplicate efficiency ratings', () => {
    const c = make({
      brand: 'MSI',
      name: 'MAG A500N-H 500W 80+ Bronze',
      category: 'psu',
      wattage: 500,
      efficiency_rating: '80+ Bronze',
      modular: 'Non',
    });
    expect(formatComponentName(c)).toBe('MSI MAG A500N-H 500W 80+ Bronze');
  });
});

describe('formatComponentName — Motherboard', () => {
  it('appends chipset and form factor if not already in model name', () => {
    const c = make({
      brand: 'ASUS',
      name: 'TUF Gaming B650-PLUS WIFI',
      category: 'motherboard',
      chipset: 'B650',
      form_factor: 'ATX',
    });
    // B650 is in model name. ATX is not.
    expect(formatComponentName(c)).toBe('ASUS TUF Gaming B650-PLUS WIFI ATX');
  });
});
