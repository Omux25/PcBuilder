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

import type { Component, CompatibilityIssue, CompatibilityResult, ComponentCategory } from '../types.js';
import { BASE_SYSTEM_LOAD_WATTS, PSU_SAFETY_MULTIPLIER, PSU_ROUNDING_STEP } from '../constants/build.constants.js';

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

  // ── Unverified Specifications Warnings (Option A) ──────────────────────────
  {
    name: 'unverified_socket',
    type: 'warning',
    components: ['cpu', 'motherboard'],
    validate: ({ cpu, motherboard }) => {
      if (cpu && motherboard && (!cpu.socket || !motherboard.socket)) {
        return `CPU socket compatibility is unverified due to missing socket data.`;
      }
      return null;
    },
  },
  {
    name: 'unverified_ram_type',
    type: 'warning',
    components: ['ram', 'motherboard'],
    validate: (build) => {
      const mb = build.motherboard;
      if (!mb) return null;
      for (const ram of getRamComponents(build)) {
        if (!ram.ram_type || !mb.supported_ram_types || mb.supported_ram_types.length === 0) {
          return `RAM type compatibility with motherboard is unverified (missing data).`;
        }
      }
      return null;
    },
  },
  {
    name: 'unverified_gpu_clearance',
    type: 'warning',
    components: ['gpu', 'case'],
    validate: (build) => {
      const pcCase = build.case;
      if (!pcCase) return null;
      for (const gpu of getGpuComponents(build)) {
        if (!gpu.length_mm || !pcCase.max_gpu_length_mm) {
          return `GPU physical length clearance is unverified (missing GPU length or Case clearance limit).`;
        }
      }
      return null;
    },
  },
  {
    name: 'unverified_cooler_clearance',
    type: 'warning',
    components: ['cooling', 'case'],
    validate: ({ cooling, case: pcCase }) => {
      if (cooling && pcCase && (!cooling.height_mm || !pcCase.max_cooler_height_mm)) {
        return `CPU Cooler height clearance in Case is unverified (missing heights or clearance limit).`;
      }
      return null;
    },
  },
  {
    name: 'unverified_cooler_socket',
    type: 'warning',
    components: ['cooling', 'cpu'],
    validate: ({ cooling, cpu }) => {
      if (cooling && cpu && (!cooling.supported_sockets || cooling.supported_sockets.length === 0 || !cpu.socket)) {
        return `CPU Cooler socket compatibility is unverified (missing socket listings).`;
      }
      return null;
    },
  },
  {
    name: 'unverified_form_factor',
    type: 'warning',
    components: ['motherboard', 'case'],
    validate: ({ motherboard, case: pcCase }) => {
      if (motherboard && pcCase && (!motherboard.form_factor || !pcCase.supported_motherboards || pcCase.supported_motherboards.length === 0)) {
        return `Motherboard form factor support in Case is unverified (missing form factors).`;
      }
      return null;
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

  if (Object.keys(build).length > 0) total_tdp += BASE_SYSTEM_LOAD_WATTS; // Base load

  const recommended_psu_wattage = Math.ceil((total_tdp * PSU_SAFETY_MULTIPLIER) / PSU_ROUNDING_STEP) * PSU_ROUNDING_STEP;

  if (build.psu?.wattage) {
    if (build.psu.wattage < total_tdp) {
      errors.push({
        rule: 'psu_underpowered',
        components: ['psu'],
        message: `Estimated load (${total_tdp}W) exceeds PSU capacity (${build.psu.wattage}W).`,
      });
    } else {
      if (build.psu.wattage < recommended_psu_wattage) {
        warnings.push({
          rule: 'psu_underpowered',
          components: ['psu'],
          message: `PSU (${build.psu.wattage}W) below recommended minimum (${recommended_psu_wattage}W).`,
        });
      }
      if (build.psu.wattage < total_tdp * 1.1) {
        warnings.push({
          rule: 'psu_tight',
          components: ['psu'],
          message: `PSU capacity (${build.psu.wattage}W) is very close to estimated load (${total_tdp}W).`,
        });
      }
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

export function evaluateCompatibility(
  component: Partial<Component>,
  currentBuild: Record<string, Partial<Component>>
): { isCompatible: boolean; reasons: string[] } {
  let isCompatible = true;
  const reasons: string[] = [];
  
  const cat = component.category;

  // CPU ↔ Motherboard
  if (cat === 'cpu' && currentBuild.motherboard) {
    if (component.socket && currentBuild.motherboard.socket && component.socket !== currentBuild.motherboard.socket) {
      isCompatible = false;
      reasons.push(`Incompatible : Socket différent (${component.socket} vs ${currentBuild.motherboard.socket})`);
    }
  }
  if (cat === 'motherboard' && currentBuild.cpu) {
    if (component.socket && currentBuild.cpu.socket && component.socket !== currentBuild.cpu.socket) {
      isCompatible = false;
      reasons.push(`Incompatible : Socket différent (${component.socket} vs ${currentBuild.cpu.socket})`);
    }
  }

  // Motherboard ↔ RAM
  if (cat === 'ram' && currentBuild.motherboard) {
    if (component.ram_type && currentBuild.motherboard.supported_ram_types) {
      if (!currentBuild.motherboard.supported_ram_types.includes(component.ram_type)) {
        isCompatible = false;
        reasons.push(`Incompatible : Type de RAM non supporté (${component.ram_type})`);
      }
    }
  }
  if (cat === 'motherboard' && currentBuild.ram) {
    if (component.supported_ram_types && currentBuild.ram.ram_type) {
      if (!component.supported_ram_types.includes(currentBuild.ram.ram_type)) {
        isCompatible = false;
        reasons.push(`Incompatible : Type de RAM non supporté par cette carte mère (${currentBuild.ram.ram_type})`);
      }
    }
  }

  // Case ↔ Motherboard
  if (cat === 'motherboard' && currentBuild.case) {
    if (component.form_factor && currentBuild.case.supported_motherboards) {
      if (!currentBuild.case.supported_motherboards.includes(component.form_factor)) {
        isCompatible = false;
        reasons.push(`Incompatible : Format de carte mère non supporté (${component.form_factor})`);
      }
    }
  }
  if (cat === 'case' && currentBuild.motherboard) {
    if (component.supported_motherboards && currentBuild.motherboard.form_factor) {
      if (!component.supported_motherboards.includes(currentBuild.motherboard.form_factor)) {
        isCompatible = false;
        reasons.push(`Incompatible : Ce boîtier ne supporte pas le format ${currentBuild.motherboard.form_factor}`);
      }
    }
  }

  // Case ↔ GPU
  if (cat === 'gpu' && currentBuild.case) {
    if (component.length_mm && currentBuild.case.max_gpu_length_mm) {
      if (component.length_mm > currentBuild.case.max_gpu_length_mm) {
        isCompatible = false;
        reasons.push(`Incompatible : GPU trop long (${component.length_mm}mm > ${currentBuild.case.max_gpu_length_mm}mm)`);
      }
    }
  }
  if (cat === 'case' && currentBuild.gpu) {
    if (component.max_gpu_length_mm && currentBuild.gpu.length_mm) {
      if (currentBuild.gpu.length_mm > component.max_gpu_length_mm) {
        isCompatible = false;
        reasons.push(`Incompatible : GPU existant trop long pour ce boîtier (${currentBuild.gpu.length_mm}mm > ${component.max_gpu_length_mm}mm)`);
      }
    }
  }

  // Case ↔ CPU Cooler
  if (cat === 'cooling' && currentBuild.case) {
    if (component.height_mm && currentBuild.case.max_cooler_height_mm) {
      if (component.height_mm > currentBuild.case.max_cooler_height_mm) {
        isCompatible = false;
        reasons.push(`Incompatible : Ventirad trop haut (${component.height_mm}mm > ${currentBuild.case.max_cooler_height_mm}mm)`);
      }
    }
  }
  if (cat === 'case' && currentBuild.cooling) {
    if (component.max_cooler_height_mm && currentBuild.cooling.height_mm) {
      if (currentBuild.cooling.height_mm > component.max_cooler_height_mm) {
        isCompatible = false;
        reasons.push(`Incompatible : Ventirad existant trop haut pour ce boîtier (${currentBuild.cooling.height_mm}mm > ${component.max_cooler_height_mm}mm)`);
      }
    }
  }

  // PSU
  if (cat === 'psu' && (currentBuild.cpu || currentBuild.gpu)) {
    const cpuTdp = currentBuild.cpu?.tdp || 0;
    const gpuTdp = currentBuild.gpu?.tdp || 0;
    const totalTdp = cpuTdp + gpuTdp;
    if (totalTdp > 0 && component.wattage) {
      if (component.wattage < totalTdp * 1.2) {
        isCompatible = false;
        reasons.push(`Incompatible : Puissance insuffisante (Nécessite au moins ${Math.ceil(totalTdp * 1.2)}W)`);
      }
    }
  }

  return { isCompatible, reasons };
}