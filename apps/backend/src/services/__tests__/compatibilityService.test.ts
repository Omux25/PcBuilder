// @ts-nocheck
/**
 * Unit tests for compatibilityService.ts
 */

import { describe, test, expect } from 'bun:test';
import { validateCompatibility } from '../compatibilityService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCpu(socket: string, tdp = 0) {
  return { socket, tdp };
}

function makeMotherboard(socket: string, supported_ram_types = ['DDR5'], max_ram_frequency = 6000, tdp = 0) {
  return { socket, supported_ram_types, max_ram_frequency, tdp };
}

function makeRam(ram_type: string, frequency_mhz: number, tdp = 0) {
  return { ram_type, frequency_mhz, tdp };
}

function makeGpu(length_mm: number, tdp = 0) {
  return { length_mm, tdp };
}

function makeCase(max_gpu_length_mm: number, tdp = 0) {
  return { max_gpu_length_mm, tdp };
}

function makePsu(wattage: number, tdp = 0) {
  return { wattage, tdp };
}

// ---------------------------------------------------------------------------
// Rule 1 — socket_mismatch
// ---------------------------------------------------------------------------

describe('socket_mismatch', () => {
  test('AM5 CPU + AM5 motherboard → no socket error', () => {
    const result = validateCompatibility({
      cpu: makeCpu('AM5'),
      motherboard: makeMotherboard('AM5'),
    });
    const socketErrors = result.errors.filter(e => e.rule === 'socket_mismatch');
    expect(socketErrors).toHaveLength(0);
    expect(result.compatible).toBe(true);
  });

  test('AM5 CPU + LGA1700 motherboard → socket_mismatch error', () => {
    const result = validateCompatibility({
      cpu: makeCpu('AM5'),
      motherboard: makeMotherboard('LGA1700'),
    });
    const socketErrors = result.errors.filter(e => e.rule === 'socket_mismatch');
    expect(socketErrors).toHaveLength(1);
    expect(socketErrors[0].components).toEqual(['cpu', 'motherboard']);
    expect(result.compatible).toBe(false);
  });

  test('only CPU present (no motherboard) → no socket error', () => {
    const result = validateCompatibility({ cpu: makeCpu('AM5') });
    const socketErrors = result.errors.filter(e => e.rule === 'socket_mismatch');
    expect(socketErrors).toHaveLength(0);
  });

  test('only motherboard present (no CPU) → no socket error', () => {
    const result = validateCompatibility({ motherboard: makeMotherboard('AM5') });
    const socketErrors = result.errors.filter(e => e.rule === 'socket_mismatch');
    expect(socketErrors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 2 — ram_type_mismatch
// ---------------------------------------------------------------------------

describe('ram_type_mismatch', () => {
  test('DDR5 RAM + DDR5 motherboard → no ram_type error', () => {
    const result = validateCompatibility({
      ram: makeRam('DDR5', 4800),
      motherboard: makeMotherboard('AM5', ['DDR5'], 6000),
    });
    const ramErrors = result.errors.filter(e => e.rule === 'ram_type_mismatch');
    expect(ramErrors).toHaveLength(0);
  });

  test('DDR4 RAM + DDR5-only motherboard → ram_type_mismatch error', () => {
    const result = validateCompatibility({
      ram: makeRam('DDR4', 3200),
      motherboard: makeMotherboard('AM5', ['DDR5'], 6000),
    });
    const ramErrors = result.errors.filter(e => e.rule === 'ram_type_mismatch');
    expect(ramErrors).toHaveLength(1);
    expect(ramErrors[0].components).toEqual(['ram', 'motherboard']);
    expect(result.compatible).toBe(false);
  });

  test('DDR4 RAM + motherboard supporting both DDR4 and DDR5 → no ram_type error', () => {
    const result = validateCompatibility({
      ram: makeRam('DDR4', 3200),
      motherboard: makeMotherboard('LGA1700', ['DDR4', 'DDR5'], 5600),
    });
    const ramErrors = result.errors.filter(e => e.rule === 'ram_type_mismatch');
    expect(ramErrors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 3 — ram_frequency_exceeded
// ---------------------------------------------------------------------------

describe('ram_frequency_exceeded', () => {
  test('RAM 6000 MHz + motherboard max 5600 MHz → ram_frequency_exceeded warning', () => {
    const result = validateCompatibility({
      ram: makeRam('DDR5', 6000),
      motherboard: makeMotherboard('AM5', ['DDR5'], 5600),
    });
    const freqWarnings = result.warnings.filter(w => w.rule === 'ram_frequency_exceeded');
    expect(freqWarnings).toHaveLength(1);
    expect(freqWarnings[0].components).toEqual(['ram', 'motherboard']);
  });

  test('RAM 4800 MHz + motherboard max 6000 MHz → no ram_frequency_exceeded warning', () => {
    const result = validateCompatibility({
      ram: makeRam('DDR5', 4800),
      motherboard: makeMotherboard('AM5', ['DDR5'], 6000),
    });
    const freqWarnings = result.warnings.filter(w => w.rule === 'ram_frequency_exceeded');
    expect(freqWarnings).toHaveLength(0);
  });

  test('RAM frequency equal to motherboard max → no warning', () => {
    const result = validateCompatibility({
      ram: makeRam('DDR5', 5600),
      motherboard: makeMotherboard('AM5', ['DDR5'], 5600),
    });
    const freqWarnings = result.warnings.filter(w => w.rule === 'ram_frequency_exceeded');
    expect(freqWarnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 4 — gpu_too_long
// ---------------------------------------------------------------------------

describe('gpu_too_long', () => {
  test('GPU 380 mm + case max 400 mm → no gpu_too_long error', () => {
    const result = validateCompatibility({
      gpu: makeGpu(380),
      case: makeCase(400),
    });
    const gpuErrors = result.errors.filter(e => e.rule === 'gpu_too_long');
    expect(gpuErrors).toHaveLength(0);
    expect(result.compatible).toBe(true);
  });

  test('GPU 420 mm + case max 400 mm → gpu_too_long error', () => {
    const result = validateCompatibility({
      gpu: makeGpu(420),
      case: makeCase(400),
    });
    const gpuErrors = result.errors.filter(e => e.rule === 'gpu_too_long');
    expect(gpuErrors).toHaveLength(1);
    expect(gpuErrors[0].components).toEqual(['gpu', 'case']);
    expect(result.compatible).toBe(false);
  });

  test('GPU length equal to case max → no gpu_too_long error', () => {
    const result = validateCompatibility({
      gpu: makeGpu(400),
      case: makeCase(400),
    });
    const gpuErrors = result.errors.filter(e => e.rule === 'gpu_too_long');
    expect(gpuErrors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 5 — TDP calculation
// ---------------------------------------------------------------------------

describe('TDP calculation', () => {
  test('components with TDP [65, 15, 200, 16, 5] → total_tdp=301, recommended_psu_wattage=452', () => {
    const result = validateCompatibility({
      cpu: makeCpu('AM5', 65),
      motherboard: makeMotherboard('AM5', ['DDR5'], 6000, 15),
      gpu: makeGpu(300, 200),
      ram: makeRam('DDR5', 4800, 16),
      storage: { tdp: 5 },
    });
    expect(result.total_tdp).toBe(301);
    expect(result.recommended_psu_wattage).toBe(Math.ceil(301 * 1.5)); // 452
  });

  test('null/undefined TDP values are treated as 0', () => {
    const result = validateCompatibility({
      cpu: { socket: 'AM5', tdp: null },
      motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, tdp: undefined },
      gpu: { length_mm: 300, tdp: 100 },
    });
    expect(result.total_tdp).toBe(100);
    expect(result.recommended_psu_wattage).toBe(Math.ceil(100 * 1.5)); // 150
  });

  test('empty build → total_tdp=0, recommended_psu_wattage=0', () => {
    const result = validateCompatibility({});
    expect(result.total_tdp).toBe(0);
    expect(result.recommended_psu_wattage).toBe(0);
  });

  test('recommended_psu_wattage uses Math.ceil', () => {
    // total_tdp=1 → 1 * 1.5 = 1.5 → ceil = 2
    const result = validateCompatibility({ cpu: makeCpu('AM5', 1) });
    expect(result.recommended_psu_wattage).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Rule 6 — psu_underpowered
// ---------------------------------------------------------------------------

describe('psu_underpowered', () => {
  test('PSU 350 W with recommended 452 W → psu_underpowered warning', () => {
    const result = validateCompatibility({
      cpu: makeCpu('AM5', 65),
      motherboard: makeMotherboard('AM5', ['DDR5'], 6000, 15),
      gpu: makeGpu(300, 200),
      ram: makeRam('DDR5', 4800, 16),
      storage: { tdp: 5 },
      psu: makePsu(350),
    });
    expect(result.recommended_psu_wattage).toBe(452);
    const psuWarnings = result.warnings.filter(w => w.rule === 'psu_underpowered');
    expect(psuWarnings).toHaveLength(1);
    expect(psuWarnings[0].components).toEqual(['psu']);
  });

  test('PSU 500 W with recommended 452 W → no psu_underpowered warning', () => {
    const result = validateCompatibility({
      cpu: makeCpu('AM5', 65),
      motherboard: makeMotherboard('AM5', ['DDR5'], 6000, 15),
      gpu: makeGpu(300, 200),
      ram: makeRam('DDR5', 4800, 16),
      storage: { tdp: 5 },
      psu: makePsu(500),
    });
    expect(result.recommended_psu_wattage).toBe(452);
    const psuWarnings = result.warnings.filter(w => w.rule === 'psu_underpowered');
    expect(psuWarnings).toHaveLength(0);
  });

  test('PSU wattage equal to recommended → no psu_underpowered warning', () => {
    const result = validateCompatibility({
      gpu: makeGpu(300, 100),
      psu: makePsu(150),
    });
    expect(result.recommended_psu_wattage).toBe(150);
    const psuWarnings = result.warnings.filter(w => w.rule === 'psu_underpowered');
    expect(psuWarnings).toHaveLength(0);
  });

  test('no PSU in build → no psu_underpowered warning', () => {
    const result = validateCompatibility({ cpu: makeCpu('AM5', 65) });
    const psuWarnings = result.warnings.filter(w => w.rule === 'psu_underpowered');
    expect(psuWarnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// compatible flag
// ---------------------------------------------------------------------------

describe('compatible flag', () => {
  test('build with no errors → compatible=true', () => {
    const result = validateCompatibility({
      cpu: makeCpu('AM5'),
      motherboard: makeMotherboard('AM5'),
    });
    expect(result.compatible).toBe(true);
  });

  test('build with at least one error → compatible=false', () => {
    const result = validateCompatibility({
      cpu: makeCpu('AM5'),
      motherboard: makeMotherboard('LGA1700'),
    });
    expect(result.compatible).toBe(false);
  });

  test('build with only warnings → compatible=true', () => {
    const result = validateCompatibility({
      ram: makeRam('DDR5', 6000),
      motherboard: makeMotherboard('AM5', ['DDR5'], 5600),
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
    expect(result.compatible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule 5 — form_factor_mismatch
// ---------------------------------------------------------------------------

describe('form_factor_mismatch', () => {
  test('ATX motherboard + ATX case → no form_factor_mismatch error', () => {
    const result = validateCompatibility({
      motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, form_factor: 'ATX' },
      case: { max_gpu_length_mm: 380, supported_motherboards: ['ATX', 'mATX', 'Mini-ITX'] },
    });
    const errors = result.errors.filter(e => e.rule === 'form_factor_mismatch');
    expect(errors).toHaveLength(0);
    expect(result.compatible).toBe(true);
  });

  test('ATX motherboard + Mini-ITX case → form_factor_mismatch error', () => {
    const result = validateCompatibility({
      motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, form_factor: 'ATX' },
      case: { max_gpu_length_mm: 300, supported_motherboards: ['Mini-ITX'] },
    });
    const errors = result.errors.filter(e => e.rule === 'form_factor_mismatch');
    expect(errors).toHaveLength(1);
    expect(errors[0].components).toEqual(['motherboard', 'case']);
    expect(result.compatible).toBe(false);
  });

  test('no form_factor on motherboard → no form_factor_mismatch error (rule skipped)', () => {
    const result = validateCompatibility({
      motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000 },
      case: { max_gpu_length_mm: 300, supported_motherboards: ['Mini-ITX'] },
    });
    const errors = result.errors.filter(e => e.rule === 'form_factor_mismatch');
    expect(errors).toHaveLength(0);
  });

  test('no supported_motherboards on case → no form_factor_mismatch error (rule skipped)', () => {
    const result = validateCompatibility({
      motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, form_factor: 'ATX' },
      case: { max_gpu_length_mm: 380 },
    });
    const errors = result.errors.filter(e => e.rule === 'form_factor_mismatch');
    expect(errors).toHaveLength(0);
  });

  test('only motherboard present (no case) → no form_factor_mismatch error', () => {
    const result = validateCompatibility({
      motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, form_factor: 'ATX' },
    });
    const errors = result.errors.filter(e => e.rule === 'form_factor_mismatch');
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 6 — cooler_too_tall
// ---------------------------------------------------------------------------

describe('cooler_too_tall', () => {
  test('cooler 155 mm + case max 165 mm → no cooler_too_tall error', () => {
    const result = validateCompatibility({
      cooling: { height_mm: 155, tdp: 150 },
      case: { max_gpu_length_mm: 380, max_cooler_height_mm: 165 },
    });
    const errors = result.errors.filter(e => e.rule === 'cooler_too_tall');
    expect(errors).toHaveLength(0);
    expect(result.compatible).toBe(true);
  });

  test('cooler 170 mm + case max 155 mm → cooler_too_tall error', () => {
    const result = validateCompatibility({
      cooling: { height_mm: 170, tdp: 150 },
      case: { max_gpu_length_mm: 380, max_cooler_height_mm: 155 },
    });
    const errors = result.errors.filter(e => e.rule === 'cooler_too_tall');
    expect(errors).toHaveLength(1);
    expect(errors[0].components).toEqual(['cooling', 'case']);
    expect(result.compatible).toBe(false);
  });

  test('cooler height equal to case max → no cooler_too_tall error', () => {
    const result = validateCompatibility({
      cooling: { height_mm: 165, tdp: 150 },
      case: { max_gpu_length_mm: 380, max_cooler_height_mm: 165 },
    });
    const errors = result.errors.filter(e => e.rule === 'cooler_too_tall');
    expect(errors).toHaveLength(0);
  });

  test('no height_mm on cooling → no cooler_too_tall error (rule skipped)', () => {
    const result = validateCompatibility({
      cooling: { tdp: 150 },
      case: { max_gpu_length_mm: 380, max_cooler_height_mm: 155 },
    });
    const errors = result.errors.filter(e => e.rule === 'cooler_too_tall');
    expect(errors).toHaveLength(0);
  });

  test('no max_cooler_height_mm on case → no cooler_too_tall error (rule skipped)', () => {
    const result = validateCompatibility({
      cooling: { height_mm: 170, tdp: 150 },
      case: { max_gpu_length_mm: 380 },
    });
    const errors = result.errors.filter(e => e.rule === 'cooler_too_tall');
    expect(errors).toHaveLength(0);
  });

  test('only cooling present (no case) → no cooler_too_tall error', () => {
    const result = validateCompatibility({
      cooling: { height_mm: 170, tdp: 150 },
    });
    const errors = result.errors.filter(e => e.rule === 'cooler_too_tall');
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule 7 — PSU excluded from TDP sum
// ---------------------------------------------------------------------------

describe('TDP calculation — PSU excluded', () => {
  test('PSU tdp is NOT included in total_tdp', () => {
    const result = validateCompatibility({
      cpu: makeCpu('AM5', 65),
      psu: makePsu(650, 50), // PSU has tdp=50 but should not be summed
    });
    // Only cpu tdp (65) should be counted — not psu tdp (50)
    expect(result.total_tdp).toBe(65);
  });

  test('recommended_psu_wattage is based only on component TDP, not PSU self-draw', () => {
    const result = validateCompatibility({
      gpu: makeGpu(300, 200),
      psu: makePsu(400, 100), // PSU tdp=100 must not inflate the recommendation
    });
    expect(result.total_tdp).toBe(200);
    expect(result.recommended_psu_wattage).toBe(Math.ceil(200 * 1.5)); // 300
  });
});

// ---------------------------------------------------------------------------
// Rule 8 — ram_slots_exceeded (multi-slot)
// ---------------------------------------------------------------------------

describe('ram_slots_exceeded', () => {
  test('2 RAM sticks + motherboard with 4 slots → no error', () => {
    const result = validateCompatibility({
      motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, ram_slots: 4 },
      ram_1: makeRam('DDR5', 6000),
      ram_2: makeRam('DDR5', 6000),
    });
    const errors = result.errors.filter(e => e.rule === 'ram_slots_exceeded');
    expect(errors).toHaveLength(0);
    expect(result.compatible).toBe(true);
  });

  test('3 RAM sticks + motherboard with 2 slots → ram_slots_exceeded error', () => {
    const result = validateCompatibility({
      motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, ram_slots: 2 },
      ram_1: makeRam('DDR5', 6000),
      ram_2: makeRam('DDR5', 6000),
      ram_3: makeRam('DDR5', 6000),
    });
    const errors = result.errors.filter(e => e.rule === 'ram_slots_exceeded');
    expect(errors).toHaveLength(1);
    expect(errors[0].components).toEqual(['ram', 'motherboard']);
    expect(result.compatible).toBe(false);
  });

  test('no ram_slots on motherboard → rule skipped', () => {
    const result = validateCompatibility({
      motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000 },
      ram_1: makeRam('DDR5', 6000),
      ram_2: makeRam('DDR5', 6000),
      ram_3: makeRam('DDR5', 6000),
      ram_4: makeRam('DDR5', 6000),
    });
    const errors = result.errors.filter(e => e.rule === 'ram_slots_exceeded');
    expect(errors).toHaveLength(0);
  });

  test('no motherboard in build → rule skipped', () => {
    const result = validateCompatibility({
      ram_1: makeRam('DDR5', 6000),
      ram_2: makeRam('DDR5', 6000),
    });
    const errors = result.errors.filter(e => e.rule === 'ram_slots_exceeded');
    expect(errors).toHaveLength(0);
  });

  test('ram_type_mismatch fires for each incompatible stick in multi-slot build', () => {
    const result = validateCompatibility({
      motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, ram_slots: 4 },
      ram_1: makeRam('DDR4', 3200), // incompatible
      ram_2: makeRam('DDR5', 6000), // compatible
    });
    const errors = result.errors.filter(e => e.rule === 'ram_type_mismatch');
    expect(errors).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Rule 9 — storage_slots_exceeded (multi-slot)
// ---------------------------------------------------------------------------

describe('storage_slots_exceeded', () => {
  test('2 drives + motherboard with 2 M.2 + 2 SATA → no error', () => {
    const result = validateCompatibility({
      motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, m2_slots: 2, sata_ports: 2 },
      storage_1: { tdp: 3 },
      storage_2: { tdp: 3 },
    });
    const errors = result.errors.filter(e => e.rule === 'storage_slots_exceeded');
    expect(errors).toHaveLength(0);
  });

  test('3 drives + motherboard with 1 M.2 + 1 SATA → storage_slots_exceeded error', () => {
    const result = validateCompatibility({
      motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, m2_slots: 1, sata_ports: 1 },
      storage_1: { tdp: 3 },
      storage_2: { tdp: 3 },
      storage_3: { tdp: 3 },
    });
    const errors = result.errors.filter(e => e.rule === 'storage_slots_exceeded');
    expect(errors).toHaveLength(1);
    expect(errors[0].components).toEqual(['storage', 'motherboard']);
    expect(result.compatible).toBe(false);
  });

  test('no m2_slots or sata_ports on motherboard → rule skipped', () => {
    const result = validateCompatibility({
      motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000 },
      storage_1: { tdp: 3 },
      storage_2: { tdp: 3 },
      storage_3: { tdp: 3 },
    });
    const errors = result.errors.filter(e => e.rule === 'storage_slots_exceeded');
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Multi-slot TDP calculation
// ---------------------------------------------------------------------------

describe('TDP calculation — multi-slot RAM and storage', () => {
  test('TDP sums across all ram_N and storage_N slots', () => {
    const result = validateCompatibility({
      cpu: makeCpu('AM5', 65),
      ram_1: makeRam('DDR5', 6000, 5),
      ram_2: makeRam('DDR5', 6000, 5),
      storage_1: { tdp: 3 },
      storage_2: { tdp: 3 },
    });
    // 65 (cpu) + 5 + 5 (ram) + 3 + 3 (storage) = 81
    expect(result.total_tdp).toBe(81);
  });

  test('legacy single ram key still contributes to TDP', () => {
    const result = validateCompatibility({
      ram: makeRam('DDR5', 6000, 10),
    });
    expect(result.total_tdp).toBe(10);
  });

  test('mix of legacy and indexed keys both contribute', () => {
    const result = validateCompatibility({
      storage: { tdp: 4 },
      storage_1: { tdp: 3 },
    });
    expect(result.total_tdp).toBe(7);
  });
});
