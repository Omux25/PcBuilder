/**
 * PC Builder Compatibility Engine
 * 
 * Logic shared between Backend (for smart search results) and Frontend (for build validation).
 * 
 * DESIGN GOALS:
 * 1. Unified: Single source of truth for all compatibility rules.
 * 2. Surgical: Targeted rules that only run when relevant components are present.
 * 3. Robust: Handles missing data gracefully (returns null/no issues).
 * 4. Performant: Minimal overhead, uses fast lookups and caches if needed.
 */

import type { Component, CompatibilityIssue, CompatibilityResult, ComponentCategory } from './types.js';

export type BuildInput = Partial<Record<ComponentCategory, Partial<Component>>> & Record<string, any>;

/**
 * Normalizes socket strings for robust comparison.
 */
function normalizeSocket(socket: string | undefined): string {
  if (!socket) return '';
  return socket.toLowerCase().replace(/[\s-]/g, '');
}

/**
 * Checks if a socket (or list of sockets) is compatible with a target socket.
 */
export function checkSocketCompatibility(source: string | string[] | undefined, target: string | undefined): boolean {
  if (!source || !target) return true;
  const normalizedTarget = normalizeSocket(target);
  const sources = Array.isArray(source) ? source : [source];
  return sources.some(s => normalizeSocket(s) === normalizedTarget);
}

// ── Component Accessors ──────────────────────────────────────────────────────

export const isRamKey = (k: string) => k === 'ram' || /^ram_\d+$/.test(k);
export const isStorageKey = (k: string) => k === 'storage' || /^storage_\d+$/.test(k);
export const isGpuKey = (k: string) => k === 'gpu' || /^gpu_\d+$/.test(k);
export const isFanKey = (k: string) => k === 'fan' || /^fan_\d+$/.test(k);

function getComponentsByPrefix(build: BuildInput, predicate: (k: string) => boolean): Partial<Component>[] {
  return Object.entries(build)
    .filter(([k]) => predicate(k))
    .map(([, v]) => v as Partial<Component>)
    .filter(Boolean);
}

export const getRamComponents = (b: BuildInput) => getComponentsByPrefix(b, isRamKey);
export const getStorageComponents = (b: BuildInput) => getComponentsByPrefix(b, isStorageKey);
export const getGpuComponents = (b: BuildInput) => getComponentsByPrefix(b, isGpuKey);
export const getFanComponents = (b: BuildInput) => getComponentsByPrefix(b, isFanKey);

interface Rule {
  name: string;
  type: 'error' | 'warning';
  components: ComponentCategory[];
  validate: (build: BuildInput) => string | null;
}

const RULES: Rule[] = [
  // ── CPU & Motherboard ──────────────────────────────────────────────────────
  {
    name: 'socket_mismatch',
    type: 'error',
    components: ['cpu', 'motherboard'],
    validate: ({ cpu, motherboard }) => {
      if (!cpu?.socket || !motherboard?.socket) return null;
      return !checkSocketCompatibility(cpu.socket, motherboard.socket)
        ? `CPU socket (${cpu.socket}) incompatible with motherboard (${motherboard.socket}).`
        : null;
    },
  },

  // ── RAM & Motherboard ──────────────────────────────────────────────────────
  {
    name: 'ram_type_mismatch',
    type: 'error',
    components: ['ram', 'motherboard'],
    validate: (build) => {
      const supported = build.motherboard?.supported_ram_types;
      if (!supported) return null;
      for (const ram of getRamComponents(build)) {
        if (ram.ram_type && !supported.includes(ram.ram_type)) {
          return `RAM type (${ram.ram_type}) not supported by motherboard (supports: ${supported.join(', ')}).`;
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
      const max = build.motherboard?.max_ram_frequency;
      if (!max) return null;
      for (const ram of getRamComponents(build)) {
        if (ram.frequency_mhz && ram.frequency_mhz > max) {
          return `RAM (${ram.frequency_mhz}MHz) exceeds motherboard max (${max}MHz). Will run at lower speed.`;
        }
      }
      return null;
    },
  },
  {
    name: 'ram_slots_exceeded',
    type: 'error',
    components: ['ram', 'motherboard'],
    validate: (build) => {
      const slots = build.motherboard?.ram_slots;
      if (!slots) return null;
      const totalSticks = getRamComponents(build).reduce((sum, r) => sum + (r.kit_count ?? 1), 0);
      return totalSticks > slots
        ? `Build uses ${totalSticks} DIMM slots but motherboard only has ${slots}.`
        : null;
    },
  },
  {
    name: 'mixed_ram_types',
    type: 'error',
    components: ['ram'],
    validate: (build) => {
      const types = [...new Set(getRamComponents(build).map(r => r.ram_type).filter(Boolean))];
      return types.length > 1 ? `Mixed RAM types (${types.join(' + ')}). All sticks must be the same type.` : null;
    },
  },

  // ── GPU & Case ──────────────────────────────────────────────────────────────
  {
    name: 'gpu_too_long',
    type: 'error',
    components: ['gpu', 'case'],
    validate: (build) => {
      const max = build.case?.max_gpu_length_mm;
      if (!max) return null;
      for (const gpu of getGpuComponents(build)) {
        if (gpu.length_mm && gpu.length_mm > max) {
          return `GPU (${gpu.length_mm}mm) too long for case (${max}mm).`;
        }
      }
      return null;
    },
  },

  // ── Cooling & CPU/Case ─────────────────────────────────────────────────────
  {
    name: 'cooler_socket_mismatch',
    type: 'error',
    components: ['cooling', 'cpu'],
    validate: ({ cooling, cpu }) => {
      if (!cooling?.supported_sockets || !cpu?.socket) return null;
      return !checkSocketCompatibility(cooling.supported_sockets, cpu.socket)
        ? `Cooler does not support CPU socket (${cpu.socket}).`
        : null;
    },
  },
  {
    name: 'cooler_too_tall',
    type: 'error',
    components: ['cooling', 'case'],
    validate: ({ cooling, case: pcCase }) => {
      const h = cooling?.height_mm;
      const m = pcCase?.max_cooler_height_mm;
      return (h && m && h > m) ? `Cooler (${h}mm) too high for case (${m}mm).` : null;
    },
  },
  {
    name: 'cpu_cooler_tdp_insufficient',
    type: 'warning',
    components: ['cooling', 'cpu'],
    validate: ({ cooling, cpu }) => {
      const cMax = cooling?.max_tdp;
      const cTdp = cpu?.tdp;
      return (cMax && cTdp && cTdp > cMax) ? `CPU TDP (${cTdp}W) exceeds cooler rating (${cMax}W).` : null;
    },
  },

  // ── Motherboard & Case ─────────────────────────────────────────────────────
  {
    name: 'form_factor_mismatch',
    type: 'error',
    components: ['motherboard', 'case'],
    validate: ({ motherboard, case: pcCase }) => {
      const format = motherboard?.form_factor;
      const supported = pcCase?.supported_motherboards;
      return (format && Array.isArray(supported) && !supported.includes(format))
        ? `Motherboard format (${format}) not supported by case.`
        : null;
    },
  },

  // ── Storage & Motherboard ──────────────────────────────────────────────────
  {
    name: 'storage_slots_exceeded',
    type: 'error',
    components: ['storage', 'motherboard'],
    validate: (build) => {
      const mb = build.motherboard;
      if (!mb) return null;
      const storage = getStorageComponents(build);
      const m2Count = storage.filter(s => s.interface_type === 'NVMe').length;
      const sataCount = storage.filter(s => s.interface_type === 'SATA' || s.interface_type === 'HDD').length;
      
      if (mb.m2_slots != null && m2Count > mb.m2_slots) {
        return `Too many NVMe drives (${m2Count}) for motherboard M.2 slots (${mb.m2_slots}).`;
      }
      if (mb.sata_ports != null && sataCount > mb.sata_ports) {
        return `Too many SATA drives (${sataCount}) for motherboard SATA ports (${mb.sata_ports}).`;
      }
      return null;
    },
  },

  // ── PSU & Case ─────────────────────────────────────────────────────────────
  {
    name: 'psu_form_factor_mismatch',
    type: 'error',
    components: ['psu', 'case'],
    validate: ({ psu, case: pcCase }) => {
      const format = psu?.psu_form_factor;
      const supported = pcCase?.supported_psu_form_factors;
      return (format && Array.isArray(supported) && supported.length > 0 && !supported.includes(format))
        ? `PSU form factor (${format}) not supported by case.`
        : null;
    },
  },
];

export function validateCompatibility(build: BuildInput): CompatibilityResult {
  const errors: CompatibilityIssue[] = [];
  const warnings: CompatibilityIssue[] = [];

  for (const rule of RULES) {
    const message = rule.validate(build);
    if (message) {
      const issue = { rule: rule.name, components: rule.components, message };
      rule.type === 'error' ? errors.push(issue) : warnings.push(issue);
    }
  }

  // ── Power Calculation ──
  const fixedComponents: ComponentCategory[] = ['cpu', 'motherboard', 'cooling'];
  let total_tdp = fixedComponents.reduce((sum, k) => sum + ((build[k] as any)?.tdp ?? 0), 0);
  
  total_tdp += getGpuComponents(build).reduce((sum, g) => sum + (g.tdp ?? 0), 0);
  total_tdp += getRamComponents(build).reduce((sum, r) => sum + (r.tdp ?? 0), 0);
  total_tdp += getStorageComponents(build).reduce((sum, s) => sum + (s.tdp ?? 0), 0);
  total_tdp += getFanComponents(build).reduce((sum, f) => sum + ((f as any).tdp ?? 0), 0);

  if (Object.keys(build).length > 0) total_tdp += 50; // Base load

  const recommended_psu_wattage = Math.ceil((total_tdp * 1.5) / 50) * 50;

  if (build.psu?.wattage) {
    if (build.psu.wattage < total_tdp) {
      errors.push({
        rule: 'psu_underpowered',
        components: ['psu'],
        message: `Estimated load (${total_tdp}W) exceeds PSU capacity (${build.psu.wattage}W).`,
      });
    } else if (build.psu.wattage < total_tdp * 1.1) {
      warnings.push({
        rule: 'psu_tight',
        components: ['psu'],
        message: `PSU capacity (${build.psu.wattage}W) is very close to estimated load (${total_tdp}W).`,
      });
    }
  }

  return {
    compatible: errors.length === 0,
    total_tdp,
    recommended_psu_wattage,
    errors,
    warnings,
  };
}


