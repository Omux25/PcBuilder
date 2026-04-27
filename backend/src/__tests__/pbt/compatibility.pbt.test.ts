/**
 * Property-Based Tests — Compatibility Engine
 *
 * Covers optional tasks: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 *
 * Each property encodes a formal correctness condition that must hold
 * for ALL inputs, not just the specific examples in the unit tests.
 *
 * Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3
 */

// @ts-nocheck
import { describe, test } from 'bun:test';
import * as fc from 'fast-check';
import { validateCompatibility } from '../../services/compatibilityService.js';

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Non-empty string — used for socket names */
const socketArb = fc.string({ minLength: 1, maxLength: 20 });

/** Non-negative integer TDP */
const tdpArb = fc.integer({ min: 0, max: 500 });

/** Positive integer wattage */
const wattageArb = fc.integer({ min: 1, max: 2000 });

/** Positive integer length in mm */
const lengthArb = fc.integer({ min: 1, max: 600 });

/** Positive integer frequency in MHz */
const freqArb = fc.integer({ min: 1, max: 10000 });

/** RAM type string */
const ramTypeArb = fc.constantFrom('DDR4', 'DDR5', 'DDR3', 'LPDDR5');

/** Non-empty array of RAM type strings */
const ramTypesArb = fc.array(ramTypeArb, { minLength: 1, maxLength: 4 });

// ── Task 2.2 — CPU/Motherboard socket consistency ─────────────────────────────

describe('PBT 2.2 — socket_mismatch rule', () => {
  test('socket_mismatch fires iff cpu.socket !== motherboard.socket', () => {
    fc.assert(fc.property(
      socketArb, socketArb,
      (cpuSocket, mbSocket) => {
        const result = validateCompatibility({
          cpu:         { socket: cpuSocket },
          motherboard: { socket: mbSocket, supported_ram_types: ['DDR5'], max_ram_frequency: 6000 },
        });

        const hasError = result.errors.some(e => e.rule === 'socket_mismatch');
        const shouldHaveError = cpuSocket !== mbSocket;

        return hasError === shouldHaveError;
      },
    ));
  });

  test('socket_mismatch never fires when only cpu is present', () => {
    fc.assert(fc.property(socketArb, (socket) => {
      const result = validateCompatibility({ cpu: { socket } });
      return !result.errors.some(e => e.rule === 'socket_mismatch');
    }));
  });

  test('socket_mismatch never fires when only motherboard is present', () => {
    fc.assert(fc.property(socketArb, (socket) => {
      const result = validateCompatibility({
        motherboard: { socket, supported_ram_types: ['DDR5'], max_ram_frequency: 6000 },
      });
      return !result.errors.some(e => e.rule === 'socket_mismatch');
    }));
  });

  test('compatible is false whenever socket_mismatch fires', () => {
    fc.assert(fc.property(
      socketArb, socketArb,
      (cpuSocket, mbSocket) => {
        fc.pre(cpuSocket !== mbSocket);
        const result = validateCompatibility({
          cpu:         { socket: cpuSocket },
          motherboard: { socket: mbSocket, supported_ram_types: ['DDR5'], max_ram_frequency: 6000 },
        });
        return result.compatible === false;
      },
    ));
  });
});

// ── Task 2.3 — RAM type/Motherboard consistency ───────────────────────────────

describe('PBT 2.3 — ram_type_mismatch rule', () => {
  test('ram_type_mismatch fires iff ram.ram_type not in motherboard.supported_ram_types', () => {
    fc.assert(fc.property(
      ramTypeArb, ramTypesArb,
      (ramType, supportedTypes) => {
        const result = validateCompatibility({
          ram:         { ram_type: ramType, frequency_mhz: 3200 },
          motherboard: { socket: 'AM5', supported_ram_types: supportedTypes, max_ram_frequency: 6000 },
        });

        const hasError = result.errors.some(e => e.rule === 'ram_type_mismatch');
        const shouldHaveError = !supportedTypes.includes(ramType);

        return hasError === shouldHaveError;
      },
    ));
  });

  test('ram_type_mismatch never fires when only ram is present', () => {
    fc.assert(fc.property(ramTypeArb, freqArb, (ramType, freq) => {
      const result = validateCompatibility({ ram: { ram_type: ramType, frequency_mhz: freq } });
      return !result.errors.some(e => e.rule === 'ram_type_mismatch');
    }));
  });

  test('ram_type_mismatch never fires when only motherboard is present', () => {
    fc.assert(fc.property(ramTypesArb, (types) => {
      const result = validateCompatibility({
        motherboard: { socket: 'AM5', supported_ram_types: types, max_ram_frequency: 6000 },
      });
      return !result.errors.some(e => e.rule === 'ram_type_mismatch');
    }));
  });
});

// ── Task 2.4 — RAM frequency exceeded warning ─────────────────────────────────

describe('PBT 2.4 — ram_frequency_exceeded rule', () => {
  test('ram_frequency_exceeded fires iff ram.frequency_mhz > motherboard.max_ram_frequency', () => {
    fc.assert(fc.property(
      freqArb, freqArb,
      (ramFreq, maxFreq) => {
        const result = validateCompatibility({
          ram:         { ram_type: 'DDR5', frequency_mhz: ramFreq },
          motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: maxFreq },
        });

        const hasWarning = result.warnings.some(w => w.rule === 'ram_frequency_exceeded');
        const shouldHaveWarning = ramFreq > maxFreq;

        return hasWarning === shouldHaveWarning;
      },
    ));
  });

  test('ram_frequency_exceeded is a warning, never an error', () => {
    fc.assert(fc.property(
      freqArb, freqArb,
      (ramFreq, maxFreq) => {
        fc.pre(ramFreq > maxFreq);
        const result = validateCompatibility({
          ram:         { ram_type: 'DDR5', frequency_mhz: ramFreq },
          motherboard: { socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: maxFreq },
        });
        // Must appear in warnings, not errors
        const inWarnings = result.warnings.some(w => w.rule === 'ram_frequency_exceeded');
        const inErrors   = result.errors.some(e => e.rule === 'ram_frequency_exceeded');
        return inWarnings && !inErrors;
      },
    ));
  });
});

// ── Task 2.5 — Total TDP + PSU recommendation ────────────────────────────────

describe('PBT 2.5 — TDP calculation', () => {
  test('total_tdp equals sum of all non-null component TDPs', () => {
    fc.assert(fc.property(
      tdpArb, tdpArb, tdpArb,
      (cpuTdp, gpuTdp, ramTdp) => {
        const result = validateCompatibility({
          cpu: { socket: 'AM5', tdp: cpuTdp },
          gpu: { length_mm: 300, tdp: gpuTdp },
          ram: { ram_type: 'DDR5', frequency_mhz: 4800, tdp: ramTdp },
        });
        return result.total_tdp === cpuTdp + gpuTdp + ramTdp;
      },
    ));
  });

  test('recommended_psu_wattage = ceil(total_tdp * 1.2)', () => {
    fc.assert(fc.property(
      tdpArb, tdpArb,
      (cpuTdp, gpuTdp) => {
        const result = validateCompatibility({
          cpu: { socket: 'AM5', tdp: cpuTdp },
          gpu: { length_mm: 300, tdp: gpuTdp },
        });
        const expected = Math.ceil((cpuTdp + gpuTdp) * 1.2);
        return result.recommended_psu_wattage === expected;
      },
    ));
  });

  test('total_tdp is always non-negative', () => {
    fc.assert(fc.property(
      tdpArb, tdpArb, tdpArb,
      (a, b, c) => {
        const result = validateCompatibility({
          cpu:     { socket: 'AM5', tdp: a },
          gpu:     { length_mm: 300, tdp: b },
          storage: { tdp: c },
        });
        return result.total_tdp >= 0;
      },
    ));
  });

  test('null/undefined TDP components contribute 0 to total_tdp', () => {
    fc.assert(fc.property(tdpArb, (gpuTdp) => {
      const result = validateCompatibility({
        cpu: { socket: 'AM5', tdp: null },
        gpu: { length_mm: 300, tdp: gpuTdp },
      });
      return result.total_tdp === gpuTdp;
    }));
  });
});

// ── Task 2.6 — Underpowered PSU warning ──────────────────────────────────────

describe('PBT 2.6 — psu_underpowered rule', () => {
  test('psu_underpowered fires iff psu.wattage < recommended_psu_wattage', () => {
    fc.assert(fc.property(
      tdpArb, wattageArb,
      (gpuTdp, psuWattage) => {
        const result = validateCompatibility({
          gpu: { length_mm: 300, tdp: gpuTdp },
          psu: { wattage: psuWattage },
        });

        const recommended = result.recommended_psu_wattage;
        const hasWarning = result.warnings.some(w => w.rule === 'psu_underpowered');
        const shouldHaveWarning = psuWattage < recommended;

        return hasWarning === shouldHaveWarning;
      },
    ));
  });

  test('psu_underpowered is a warning, never an error', () => {
    fc.assert(fc.property(
      tdpArb, wattageArb,
      (gpuTdp, psuWattage) => {
        const result = validateCompatibility({
          gpu: { length_mm: 300, tdp: gpuTdp },
          psu: { wattage: psuWattage },
        });
        const inErrors = result.errors.some(e => e.rule === 'psu_underpowered');
        return !inErrors;
      },
    ));
  });

  test('psu_underpowered never fires when psu is absent', () => {
    fc.assert(fc.property(tdpArb, (gpuTdp) => {
      const result = validateCompatibility({ gpu: { length_mm: 300, tdp: gpuTdp } });
      return !result.warnings.some(w => w.rule === 'psu_underpowered');
    }));
  });
});

// ── Task 2.7 — GPU/Case clearance ────────────────────────────────────────────

describe('PBT 2.7 — gpu_too_long rule', () => {
  test('gpu_too_long fires iff gpu.length_mm > case.max_gpu_length_mm', () => {
    fc.assert(fc.property(
      lengthArb, lengthArb,
      (gpuLen, caseMax) => {
        const result = validateCompatibility({
          gpu:  { length_mm: gpuLen },
          case: { max_gpu_length_mm: caseMax },
        });

        const hasError = result.errors.some(e => e.rule === 'gpu_too_long');
        const shouldHaveError = gpuLen > caseMax;

        return hasError === shouldHaveError;
      },
    ));
  });

  test('gpu_too_long never fires when only gpu is present', () => {
    fc.assert(fc.property(lengthArb, (len) => {
      const result = validateCompatibility({ gpu: { length_mm: len } });
      return !result.errors.some(e => e.rule === 'gpu_too_long');
    }));
  });

  test('gpu_too_long never fires when only case is present', () => {
    fc.assert(fc.property(lengthArb, (len) => {
      const result = validateCompatibility({ case: { max_gpu_length_mm: len } });
      return !result.errors.some(e => e.rule === 'gpu_too_long');
    }));
  });

  test('compatible is false whenever gpu_too_long fires', () => {
    fc.assert(fc.property(
      lengthArb, lengthArb,
      (gpuLen, caseMax) => {
        fc.pre(gpuLen > caseMax);
        const result = validateCompatibility({
          gpu:  { length_mm: gpuLen },
          case: { max_gpu_length_mm: caseMax },
        });
        return result.compatible === false;
      },
    ));
  });
});

// ── Global invariants ─────────────────────────────────────────────────────────

describe('PBT — global invariants', () => {
  test('compatible is true iff errors array is empty', () => {
    fc.assert(fc.property(
      socketArb, socketArb, ramTypeArb, ramTypesArb, lengthArb, lengthArb,
      (cpuSocket, mbSocket, ramType, supportedTypes, gpuLen, caseMax) => {
        const result = validateCompatibility({
          cpu:         { socket: cpuSocket },
          motherboard: { socket: mbSocket, supported_ram_types: supportedTypes, max_ram_frequency: 6000 },
          ram:         { ram_type: ramType, frequency_mhz: 3200 },
          gpu:         { length_mm: gpuLen },
          case:        { max_gpu_length_mm: caseMax },
        });
        return result.compatible === (result.errors.length === 0);
      },
    ));
  });

  test('result always has all required fields', () => {
    fc.assert(fc.property(socketArb, (socket) => {
      const result = validateCompatibility({ cpu: { socket } });
      return (
        typeof result.compatible === 'boolean' &&
        typeof result.total_tdp === 'number' &&
        typeof result.recommended_psu_wattage === 'number' &&
        Array.isArray(result.errors) &&
        Array.isArray(result.warnings)
      );
    }));
  });
});
