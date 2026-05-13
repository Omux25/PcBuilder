// @ts-nocheck
import { describe, it, expect } from 'bun:test';
import {
  extractGpuVariant,
  extractCpuVariant,
  extractRamVariant,
  extractStorageVariant,
  extractPsuVariant,
  extractCoolingVariant,
  extractCaseVariant,
  extractMotherboardVariant,
  extractVariant,
} from '../variantExtractor.js';

// ── GPU ───────────────────────────────────────────────────────────────────────

describe('extractGpuVariant', () => {
  it('detects Sapphire as AIB partner', () => {
    const { details } = extractGpuVariant('Sapphire PULSE RX 7900 XTX 24GB');
    expect(details.aib_partner).toBe('Sapphire');
  });

  it('detects Sapphire Pulse model tier', () => {
    const { details } = extractGpuVariant('Sapphire PULSE RX 7900 XTX 24GB');
    expect(details.model_tier).toBe('Pulse');
  });

  it('detects ASUS ROG Strix tier', () => {
    const { details } = extractGpuVariant('ASUS ROG Strix RTX 4090 OC 24GB');
    expect(details.aib_partner).toBe('ASUS');
    expect(details.model_tier).toBe('ROG Strix');
  });

  it('detects MSI Gaming X Trio tier', () => {
    const { details } = extractGpuVariant('MSI GeForce RTX 4080 Gaming X Trio 16G');
    expect(details.aib_partner).toBe('MSI');
    expect(details.model_tier).toBe('Gaming X Trio');
  });

  it('detects VRAM from product name', () => {
    const { details } = extractGpuVariant('Gigabyte RTX 4090 AORUS Master 24GB');
    expect(details.vram_gb).toBe(24);
  });

  it('builds label from partner + tier + vram', () => {
    const { label } = extractGpuVariant('Sapphire PULSE RX 7900 XTX 24GB');
    expect(label).toBe('Sapphire Pulse 24GB');
  });

  it('falls back to truncated product name when no partner detected', () => {
    const { label } = extractGpuVariant('Generic RTX 4090 Card');
    expect(label.length).toBeGreaterThan(0);
  });

  it('handles unknown AIB partner gracefully', () => {
    const { details } = extractGpuVariant('UnknownBrand RTX 4090 OC 24GB');
    expect(details.aib_partner).toBeUndefined();
  });
});

// ── CPU ───────────────────────────────────────────────────────────────────────

describe('extractCpuVariant', () => {
  it('defaults to BOX packaging', () => {
    const { details } = extractCpuVariant('AMD Ryzen 5 7600X');
    expect(details.packaging).toBe('BOX');
  });

  it('detects Tray packaging', () => {
    const { details } = extractCpuVariant('AMD Ryzen 5 7600X Tray');
    expect(details.packaging).toBe('Tray');
  });

  it('detects MPK packaging', () => {
    const { details } = extractCpuVariant('Intel Core i5-13600K MPK');
    expect(details.packaging).toBe('MPK');
  });

  it('detects OEM packaging', () => {
    const { details } = extractCpuVariant('Intel Core i5-13600K OEM');
    expect(details.packaging).toBe('OEM');
  });

  it('detects 3D V-Cache', () => {
    const { details } = extractCpuVariant('AMD Ryzen 9 7950X3D Box');
    expect(details.has_3d_vcache).toBe(true);
  });

  it('does not set 3D V-Cache for regular CPU', () => {
    const { details } = extractCpuVariant('AMD Ryzen 5 7600X Box');
    expect(details.has_3d_vcache).toBeUndefined();
  });

  it('detects unlocked multiplier for Intel K-series', () => {
    const { details } = extractCpuVariant('Intel Core i9-14900K Box');
    expect(details.unlocked_multiplier).toBe(true);
  });

  it('detects no iGPU for Intel F-series', () => {
    const { details } = extractCpuVariant('Intel Core i5-13400F Box');
    expect(details.has_igpu).toBe(false);
  });

  it('label equals the packaging string', () => {
    const { label } = extractCpuVariant('AMD Ryzen 5 7600X Tray');
    expect(label).toBe('Tray');
  });
});

// ── RAM ───────────────────────────────────────────────────────────────────────

describe('extractRamVariant', () => {
  it('detects kit config from 2x16GB notation', () => {
    const { details } = extractRamVariant('G.Skill Trident Z5 2x16GB DDR5 6000MHz CL30');
    expect(details.kit_config).toBe('2x16GB');
  });

  it('detects EXPO memory profile', () => {
    const { details } = extractRamVariant('Kingston Fury Beast DDR5 32GB 6000 EXPO');
    expect(details.memory_profile).toBe('EXPO');
  });

  it('detects XMP memory profile', () => {
    const { details } = extractRamVariant('Corsair Vengeance DDR5 32GB 6000 XMP');
    expect(details.memory_profile).toBe('XMP');
  });

  it('detects CAS latency', () => {
    const { details } = extractRamVariant('G.Skill Trident Z5 32GB DDR5 6000 CL30');
    expect(details.cas_latency).toBe(30);
  });

  it('detects White color', () => {
    const { details } = extractRamVariant('Corsair Vengeance DDR5 32GB 6000 White');
    expect(details.color).toBe('White');
  });

  it('detects Black color', () => {
    const { details } = extractRamVariant('Kingston Fury Beast DDR5 32GB 6000 Black');
    expect(details.color).toBe('Black');
  });

  it('builds label from kit + profile + CL', () => {
    const { label } = extractRamVariant('G.Skill Trident Z5 2x16GB DDR5 6000 XMP CL30');
    expect(label).toContain('2x16GB');
    expect(label).toContain('XMP');
    expect(label).toContain('CL30');
  });

  it('returns empty label when no variant info found', () => {
    const { label } = extractRamVariant('Some RAM Module');
    expect(label).toBe('');
  });
});

// ── Storage ───────────────────────────────────────────────────────────────────

describe('extractStorageVariant', () => {
  it('detects M.2 form factor from nvme keyword', () => {
    const { details } = extractStorageVariant('Samsung 990 Pro 2TB NVMe M.2');
    expect(details.form_factor).toBe('M.2 2280');
  });

  it('detects M.2 2230 form factor', () => {
    const { details } = extractStorageVariant('WD SN740 1TB M.2 2230 NVMe');
    expect(details.form_factor).toBe('M.2 2230');
  });

  it('detects 2.5" SATA form factor', () => {
    const { details } = extractStorageVariant('Samsung 870 EVO 1TB 2.5 SATA SSD');
    expect(details.form_factor).toBe('2.5" SATA');
  });

  it('detects Gen4 PCIe', () => {
    const { details } = extractStorageVariant('Samsung 980 PRO 1TB NVMe PCIe Gen4');
    expect(details.pcie_gen).toBe('Gen4');
  });

  it('detects Gen5 PCIe', () => {
    const { details } = extractStorageVariant('Crucial T705 2TB NVMe PCIe Gen5');
    expect(details.pcie_gen).toBe('Gen5');
  });

  it('detects heatsink', () => {
    const { details } = extractStorageVariant('Samsung 990 Pro 2TB NVMe with Heatsink');
    expect(details.has_heatsink).toBe(true);
  });

  it('builds label with gen + heatsink', () => {
    const { label } = extractStorageVariant('Samsung 990 Pro 2TB NVMe Gen4 + Heatsink');
    expect(label).toContain('Gen4');
    expect(label).toContain('Heatsink');
  });
});

// ── PSU ───────────────────────────────────────────────────────────────────────

describe('extractPsuVariant', () => {
  it('detects fully modular', () => {
    const { details } = extractPsuVariant('Corsair RM850x 850W Fully Modular 80+ Gold');
    expect(details.modularity).toBe('Fully modular');
  });

  it('detects semi-modular', () => {
    const { details } = extractPsuVariant('Seasonic Focus GM 750W Semi-Modular');
    expect(details.modularity).toBe('Semi-modular');
  });

  it('defaults to non-modular', () => {
    const { details } = extractPsuVariant('Corsair CV650 650W 80+ Bronze');
    expect(details.modularity).toBe('Non-modular');
  });

  it('detects ATX 3.0', () => {
    const { details } = extractPsuVariant('be quiet! Pure Power 12 M 850W ATX 3.0');
    expect(details.atx_version).toBe('ATX 3.0');
  });

  it('detects ATX 3.1', () => {
    const { details } = extractPsuVariant('Corsair RM1000e 1000W ATX 3.1 Fully Modular');
    expect(details.atx_version).toBe('ATX 3.1');
  });

  it('detects White color', () => {
    const { details } = extractPsuVariant('Corsair RM850x 850W White Fully Modular');
    expect(details.color).toBe('White');
  });

  it('label excludes non-modular (default)', () => {
    const { label } = extractPsuVariant('Corsair CV650 650W 80+ Bronze');
    expect(label).not.toContain('Non-modular');
  });
});

// ── Cooling ───────────────────────────────────────────────────────────────────

describe('extractCoolingVariant', () => {
  it('detects 360mm radiator size', () => {
    const { details } = extractCoolingVariant('Corsair iCUE H150i Elite 360mm AIO');
    expect(details.size_mm).toBe(360);
  });

  it('detects 240mm radiator size', () => {
    const { details } = extractCoolingVariant('NZXT Kraken 240mm AIO');
    expect(details.size_mm).toBe(240);
  });

  it('detects White color', () => {
    const { details } = extractCoolingVariant('Corsair iCUE H150i Elite 360mm White');
    expect(details.color).toBe('White');
  });

  it('detects Black color', () => {
    const { details } = extractCoolingVariant('Noctua NH-D15 Black');
    expect(details.color).toBe('Black');
  });

  it('builds label from size + color', () => {
    const { label } = extractCoolingVariant('Corsair iCUE H150i 360mm White');
    expect(label).toBe('360mm White');
  });

  it('returns empty label for air cooler with no color or size', () => {
    const { label } = extractCoolingVariant('Noctua NH-U12S');
    expect(label).toBe('');
  });
});

// ── Case ──────────────────────────────────────────────────────────────────────

describe('extractCaseVariant', () => {
  it('detects White color', () => {
    const { details } = extractCaseVariant('Fractal Design Meshify 2 White');
    expect(details.color).toBe('White');
  });

  it('detects Black color', () => {
    const { details } = extractCaseVariant('Lian Li O11 Dynamic Black');
    expect(details.color).toBe('Black');
  });

  it('detects Pink color', () => {
    const { details } = extractCaseVariant('Lian Li O11 Dynamic Pink');
    expect(details.color).toBe('Pink');
  });

  it('detects Snow as White', () => {
    const { details } = extractCaseVariant('Fractal Design North Snow');
    expect(details.color).toBe('White');
  });

  it('label equals the color', () => {
    const { label } = extractCaseVariant('Fractal Design Meshify 2 White');
    expect(label).toBe('White');
  });

  it('returns empty label when no color detected', () => {
    const { label } = extractCaseVariant('Fractal Design Meshify 2');
    expect(label).toBe('');
  });
});

// ── Motherboard ───────────────────────────────────────────────────────────────

describe('extractMotherboardVariant', () => {
  it('detects DDR5', () => {
    const { details } = extractMotherboardVariant('ASUS ROG STRIX B650E-F GAMING WIFI DDR5');
    expect(details.ddr_standard).toBe('DDR5');
  });

  it('detects DDR4', () => {
    const { details } = extractMotherboardVariant('MSI MAG B550 TOMAHAWK DDR4');
    expect(details.ddr_standard).toBe('DDR4');
  });

  it('detects D4 shorthand as DDR4', () => {
    const { details } = extractMotherboardVariant('Gigabyte B660M DS3H D4');
    expect(details.ddr_standard).toBe('DDR4');
  });

  it('detects revision number', () => {
    const { details } = extractMotherboardVariant('MSI B450 TOMAHAWK MAX Rev 2.0');
    expect(details.revision).toBe('Rev 2.0');
  });

  it('builds label from DDR standard', () => {
    const { label } = extractMotherboardVariant('ASUS ROG STRIX B650E-F DDR5');
    expect(label).toContain('DDR5');
  });

  it('returns empty label when no variant info', () => {
    const { label } = extractMotherboardVariant('Generic Motherboard');
    expect(label).toBe('');
  });
});

// ── Main dispatcher ───────────────────────────────────────────────────────────

describe('extractVariant dispatcher', () => {
  it('dispatches to GPU extractor', () => {
    const { details } = extractVariant('Sapphire PULSE RX 7900 XTX 24GB', 'gpu');
    expect(details.aib_partner).toBe('Sapphire');
  });

  it('dispatches to CPU extractor', () => {
    const { label } = extractVariant('AMD Ryzen 5 7600X Tray', 'cpu');
    expect(label).toBe('Tray');
  });

  it('dispatches to RAM extractor', () => {
    const { details } = extractVariant('Corsair Vengeance DDR5 32GB 6000 XMP CL30', 'ram');
    expect(details.memory_profile).toBe('XMP');
  });

  it('dispatches to storage extractor', () => {
    const { details } = extractVariant('Samsung 990 Pro 2TB NVMe Gen4', 'storage');
    expect(details.pcie_gen).toBe('Gen4');
  });

  it('dispatches to PSU extractor', () => {
    const { details } = extractVariant('Corsair RM850x 850W Fully Modular', 'psu');
    expect(details.modularity).toBe('Fully modular');
  });

  it('dispatches to cooling extractor', () => {
    const { details } = extractVariant('Corsair iCUE H150i 360mm', 'cooling');
    expect(details.size_mm).toBe(360);
  });

  it('dispatches to case extractor', () => {
    const { details } = extractVariant('Fractal Design Meshify 2 White', 'case');
    expect(details.color).toBe('White');
  });

  it('dispatches to motherboard extractor', () => {
    const { details } = extractVariant('ASUS ROG STRIX B650E-F DDR5', 'motherboard');
    expect(details.ddr_standard).toBe('DDR5');
  });

  it('returns empty result for unknown category', () => {
    const { label, details } = extractVariant('Some Product', 'unknown_category');
    expect(label).toBe('');
    expect(details).toEqual({});
  });

  it('returns empty result for empty product name', () => {
    const { label, details } = extractVariant('', 'gpu');
    expect(label).toBe('');
    expect(details).toEqual({});
  });
});
