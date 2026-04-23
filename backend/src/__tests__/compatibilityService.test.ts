/**
 * Unit tests for compatibilityService.js
 * Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3
 */

import { validateCompatibility } from '../services/compatibilityService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCpu(socket, tdp = 0) {
  return { socket, tdp };
}

function makeMotherboard(socket, supported_ram_types = ['DDR5'], max_ram_frequency = 6000, tdp = 0) {
  return { socket, supported_ram_types, max_ram_frequency, tdp };
}

function makeRam(ram_type, frequency_mhz, tdp = 0) {
  return { ram_type, frequency_mhz, tdp };
}

function makeGpu(length_mm, tdp = 0) {
  return { length_mm, tdp };
}

function makeCase(max_gpu_length_mm, tdp = 0) {
  return { max_gpu_length_mm, tdp };
}

function makePsu(wattage, tdp = 0) {
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
  test('components with TDP [65, 15, 200, 16, 5] → total_tdp=301, recommended_psu_wattage=362', () => {
    // cpu=65, motherboard=15, gpu=200, ram=16, storage=5
    const result = validateCompatibility({
      cpu: makeCpu('AM5', 65),
      motherboard: makeMotherboard('AM5', ['DDR5'], 6000, 15),
      gpu: makeGpu(300, 200),
      ram: makeRam('DDR5', 4800, 16),
      storage: { tdp: 5 },
    });
    expect(result.total_tdp).toBe(301);
    expect(result.recommended_psu_wattage).toBe(Math.ceil(301 * 1.2)); // 362
  });

  test('null/undefined TDP values are treated as 0', () => {
    const result = validateCompatibility({
      cpu: { socket: 'AM5', tdp: null },
      motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, tdp: undefined },
      gpu: { length_mm: 300, tdp: 100 },
    });
    expect(result.total_tdp).toBe(100);
    expect(result.recommended_psu_wattage).toBe(Math.ceil(100 * 1.2)); // 120
  });

  test('empty build → total_tdp=0, recommended_psu_wattage=0', () => {
    const result = validateCompatibility({});
    expect(result.total_tdp).toBe(0);
    expect(result.recommended_psu_wattage).toBe(0);
  });

  test('recommended_psu_wattage uses Math.ceil', () => {
    // total_tdp=1 → 1 * 1.2 = 1.2 → ceil = 2
    const result = validateCompatibility({ cpu: makeCpu('AM5', 1) });
    expect(result.recommended_psu_wattage).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Rule 6 — psu_underpowered
// ---------------------------------------------------------------------------

describe('psu_underpowered', () => {
  test('PSU 350 W with recommended 362 W → psu_underpowered warning', () => {
    // total_tdp=301 → recommended=362
    const result = validateCompatibility({
      cpu: makeCpu('AM5', 65),
      motherboard: makeMotherboard('AM5', ['DDR5'], 6000, 15),
      gpu: makeGpu(300, 200),
      ram: makeRam('DDR5', 4800, 16),
      storage: { tdp: 5 },
      psu: makePsu(350),
    });
    expect(result.recommended_psu_wattage).toBe(362);
    const psuWarnings = result.warnings.filter(w => w.rule === 'psu_underpowered');
    expect(psuWarnings).toHaveLength(1);
    expect(psuWarnings[0].components).toEqual(['psu']);
  });

  test('PSU 400 W with recommended 362 W → no psu_underpowered warning', () => {
    const result = validateCompatibility({
      cpu: makeCpu('AM5', 65),
      motherboard: makeMotherboard('AM5', ['DDR5'], 6000, 15),
      gpu: makeGpu(300, 200),
      ram: makeRam('DDR5', 4800, 16),
      storage: { tdp: 5 },
      psu: makePsu(400),
    });
    expect(result.recommended_psu_wattage).toBe(362);
    const psuWarnings = result.warnings.filter(w => w.rule === 'psu_underpowered');
    expect(psuWarnings).toHaveLength(0);
  });

  test('PSU wattage equal to recommended → no psu_underpowered warning', () => {
    // total_tdp=100 → recommended=120
    const result = validateCompatibility({
      gpu: makeGpu(300, 100),
      psu: makePsu(120),
    });
    expect(result.recommended_psu_wattage).toBe(120);
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
