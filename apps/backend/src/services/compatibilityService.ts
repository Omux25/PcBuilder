/**
 * Compatibility Engine — Refactored Modular Logic
 * Validates a PC build configuration against a set of extensible rules.
 *
 * Multi-slot support: RAM and storage can occupy multiple slots in the build.
 * Keys ram_1..ram_4 and storage_1..storage_4 are treated as the same category
 * for type/frequency checks. The motherboard's ram_slots, m2_slots, and
 * sata_ports fields drive the slot-count rules.
 */

import type { CompatibilityIssue, CompatibilityResult, Component } from '@shared/types';

// ── Build input type ─────────────────────────────────────────────────────────

/**
 * A build can have:
 * - Single-slot categories: cpu, motherboard, gpu, psu, case, cooling
 * - Multi-slot categories: ram (ram_1..ram_4), storage (storage_1..storage_4)
 *
 * The legacy single keys 'ram' and 'storage' are also accepted for backwards
 * compatibility with existing tests and URL-restored builds.
 */
export type BuildInput = Partial<Record<string, Partial<Component>>>;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the key belongs to the RAM category. */
export function isRamKey(key: string): boolean {
  return key === 'ram' || /^ram_\d+$/.test(key);
}

/** Returns true if the key belongs to the storage category. */
export function isStorageKey(key: string): boolean {
  return key === 'storage' || /^storage_\d+$/.test(key);
}

/** Collect all RAM components from a build (any ram / ram_N key). */
function getRamComponents(build: BuildInput): Partial<Component>[] {
  return Object.entries(build)
    .filter(([k]) => isRamKey(k))
    .map(([, v]) => v!)
    .filter(Boolean);
}

/** Collect all storage components from a build (any storage / storage_N key). */
function getStorageComponents(build: BuildInput): Partial<Component>[] {
  return Object.entries(build)
    .filter(([k]) => isStorageKey(k))
    .map(([, v]) => v!)
    .filter(Boolean);
}

// ── Rules ────────────────────────────────────────────────────────────────────

interface Rule {
  name: string;
  type: 'error' | 'warning';
  components: string[];
  validate: (build: BuildInput) => string | null;
}

const RULES: Rule[] = [
  {
    name: 'socket_mismatch',
    type: 'error',
    components: ['cpu', 'motherboard'],
    validate: ({ cpu, motherboard }) =>
      (cpu?.socket && motherboard?.socket && cpu.socket !== motherboard.socket)
        ? `CPU socket (${cpu.socket}) incompatible with motherboard (${motherboard.socket}).`
        : null,
  },
  {
    name: 'ram_type_mismatch',
    type: 'error',
    components: ['ram', 'motherboard'],
    validate: (build) => {
      const mb = build.motherboard;
      if (!mb?.supported_ram_types) return null;
      // Check every RAM stick — all must be compatible
      for (const ram of getRamComponents(build)) {
        if (ram.ram_type && !mb.supported_ram_types.includes(ram.ram_type)) {
          return `RAM type (${ram.ram_type}) not supported by motherboard.`;
        }
      }
      return null;
    },
  },
  {
    name: 'ram_frequency_exceeded',
    type: 'warning',
    components: ['ram', 'motherboard'],
    validate: (build) => {
      const mb = build.motherboard;
      if (!mb?.max_ram_frequency) return null;
      for (const ram of getRamComponents(build)) {
        if (ram.frequency_mhz && ram.frequency_mhz > mb.max_ram_frequency) {
          return `RAM (${ram.frequency_mhz}MHz) exceeds motherboard max (${mb.max_ram_frequency}MHz).`;
        }
      }
      return null;
    },
  },
  {
    name: 'gpu_too_long',
    type: 'error',
    components: ['gpu', 'case'],
    validate: ({ gpu, case: pcCase }) =>
      (gpu?.length_mm && pcCase?.max_gpu_length_mm && gpu.length_mm > pcCase.max_gpu_length_mm)
        ? `GPU (${gpu.length_mm}mm) too long for case (${pcCase.max_gpu_length_mm}mm).`
        : null,
  },
  {
    name: 'form_factor_mismatch',
    type: 'error',
    components: ['motherboard', 'case'],
    validate: ({ motherboard, case: pcCase }) => {
      const mbFormat = motherboard?.form_factor;
      const supported = pcCase?.supported_motherboards;
      if (mbFormat && Array.isArray(supported) && !supported.includes(mbFormat)) {
        return `Motherboard format (${mbFormat}) not supported by case.`;
      }
      return null;
    },
  },
  {
    name: 'cooler_too_tall',
    type: 'error',
    components: ['cooling', 'case'],
    validate: ({ cooling, case: pcCase }) => {
      const height = cooling?.height_mm;
      const max = pcCase?.max_cooler_height_mm;
      return (height && max && height > max)
        ? `Cooler (${height}mm) too high for case (${max}mm).`
        : null;
    },
  },
  {
    name: 'ram_slots_exceeded',
    type: 'error',
    components: ['ram', 'motherboard'],
    validate: (build) => {
      const slots = build.motherboard?.ram_slots;
      if (!slots) return null; // no data — skip rule
      const count = getRamComponents(build).length;
      return count > slots
        ? `Build has ${count} RAM sticks but motherboard only has ${slots} DIMM slot${slots > 1 ? 's' : ''}.`
        : null;
    },
  },
  {
    name: 'storage_slots_exceeded',
    type: 'error',
    components: ['storage', 'motherboard'],
    validate: (build) => {
      const mb = build.motherboard;
      // Only fire if at least one slot count is defined
      if (mb?.m2_slots == null && mb?.sata_ports == null) return null;
      const totalSlots = (mb.m2_slots ?? 0) + (mb.sata_ports ?? 0);
      const count = getStorageComponents(build).length;
      return count > totalSlots
        ? `Build has ${count} storage drives but motherboard only has ${totalSlots} storage slot${totalSlots > 1 ? 's' : ''} (${mb.m2_slots ?? 0} M.2 + ${mb.sata_ports ?? 0} SATA).`
        : null;
    },
  },
];

// ── Main validator ────────────────────────────────────────────────────────────

export function validateCompatibility(build: BuildInput): CompatibilityResult {
  const errors: CompatibilityIssue[] = [];
  const warnings: CompatibilityIssue[] = [];

  // Run all declarative rules
  for (const rule of RULES) {
    const message = rule.validate(build);
    if (message) {
      const issue = { rule: rule.name, components: rule.components, message };
      rule.type === 'error' ? errors.push(issue) : warnings.push(issue);
    }
  }

  // Calculate TDP — sum across all slots including multi-slot RAM and storage
  const singleSlotKeys: Array<keyof BuildInput> = ['cpu', 'motherboard', 'gpu', 'cooling'];
  let total_tdp = singleSlotKeys.reduce((sum, key) => sum + (build[key]?.tdp ?? 0), 0);

  // Add TDP from all RAM sticks
  for (const ram of getRamComponents(build)) {
    total_tdp += ram.tdp ?? 0;
  }
  // Add TDP from all storage drives
  for (const storage of getStorageComponents(build)) {
    total_tdp += storage.tdp ?? 0;
  }

  const recommended_psu_wattage = Math.ceil(total_tdp * 1.5);

  // PSU Rule (Calculated)
  if (build.psu?.wattage && build.psu.wattage < recommended_psu_wattage) {
    warnings.push({
      rule: 'psu_underpowered',
      components: ['psu'],
      message: `PSU (${build.psu.wattage}W) below recommended minimum (${recommended_psu_wattage}W).`,
    });
  }

  return {
    compatible: errors.length === 0,
    total_tdp,
    recommended_psu_wattage,
    errors,
    warnings,
  };
}
