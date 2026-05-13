import type { Component, CompatibilityIssue, CompatibilityResult } from './types.js';

export type BuildInput = Partial<Record<string, Partial<Component>>>;

export function isRamKey(key: string): boolean {
  return key === 'ram' || /^ram_\d+$/.test(key);
}

export function isStorageKey(key: string): boolean {
  return key === 'storage' || /^storage_\d+$/.test(key);
}

export function getRamComponents(build: BuildInput): Partial<Component>[] {
  return Object.entries(build)
    .filter(([k]) => isRamKey(k))
    .map(([, v]) => v!)
    .filter(Boolean);
}

export function getStorageComponents(build: BuildInput): Partial<Component>[] {
  return Object.entries(build)
    .filter(([k]) => isStorageKey(k))
    .map(([, v]) => v!)
    .filter(Boolean);
}

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
      if (!slots) return null;
      const totalSticks = getRamComponents(build)
        .reduce((sum, r) => sum + (r.kit_count ?? 1), 0);
      return totalSticks > slots
        ? `Build uses ${totalSticks} DIMM slot${totalSticks > 1 ? 's' : ''} but motherboard only has ${slots}.`
        : null;
    },
  },
  {
    name: 'storage_slots_exceeded',
    type: 'error',
    components: ['storage', 'motherboard'],
    validate: (build) => {
      const mb = build.motherboard;
      if (mb?.m2_slots == null && mb?.sata_ports == null) return null;
      const totalSlots = (mb.m2_slots ?? 0) + (mb.sata_ports ?? 0);
      const count = getStorageComponents(build).length;
      return count > totalSlots
        ? `Build has ${count} storage drives but motherboard only has ${totalSlots} storage slot${totalSlots > 1 ? 's' : ''} (${mb.m2_slots ?? 0} M.2 + ${mb.sata_ports ?? 0} SATA).`
        : null;
    },
  },
  {
    name: 'cooler_socket_mismatch',
    type: 'error',
    components: ['cooling', 'cpu'],
    validate: ({ cooling, cpu }) => {
      const supported = cooling?.supported_sockets;
      const cpuSocket = cpu?.socket;
      if (!supported || !cpuSocket) return null;
      return !supported.includes(cpuSocket)
        ? `Cooler does not support CPU socket (${cpuSocket}). Supported: ${supported.join(', ')}.`
        : null;
    },
  },
  {
    name: 'mixed_ram_types',
    type: 'error',
    components: ['ram'],
    validate: (build) => {
      const sticks = getRamComponents(build);
      if (sticks.length < 2) return null;
      const types = [...new Set(sticks.map(r => r.ram_type).filter(Boolean))];
      return types.length > 1
        ? `Mixed RAM types in build (${types.join(' + ')}). All sticks must be the same type.`
        : null;
    },
  },
  {
    name: 'mixed_ram_frequencies',
    type: 'warning',
    components: ['ram'],
    validate: (build) => {
      const sticks = getRamComponents(build);
      if (sticks.length < 2) return null;
      const freqs = [...new Set(sticks.map(r => r.frequency_mhz).filter(Boolean))];
      if (freqs.length <= 1) return null;
      const min = Math.min(...(freqs as number[]));
      return `RAM sticks have different frequencies (${(freqs as number[]).join(', ')} MHz). System will run at ${min} MHz.`;
    },
  },
  {
    name: 'cpu_cooler_tdp_insufficient',
    type: 'warning',
    components: ['cooling', 'cpu'],
    validate: ({ cooling, cpu }) => {
      const coolerMax = cooling?.max_tdp;
      const cpuTdp = cpu?.tdp;
      if (!coolerMax || !cpuTdp) return null;
      return cpuTdp > coolerMax
        ? `CPU TDP (${cpuTdp}W) exceeds cooler rating (${coolerMax}W). System may thermal throttle.`
        : null;
    },
  },
  {
    name: 'dual_channel_warning',
    type: 'warning',
    components: ['ram'],
    validate: (build) => {
      const totalSticks = getRamComponents(build)
        .reduce((sum, r) => sum + (r.kit_count ?? 1), 0);
      if (totalSticks === 0) return null;
      return totalSticks % 2 !== 0
        ? `${totalSticks} DIMM slot${totalSticks > 1 ? 's' : ''} used. Use an even number (2 or 4) for dual-channel performance.`
        : null;
    },
  },
  {
    name: 'psu_form_factor_mismatch',
    type: 'error',
    components: ['psu', 'case'],
    validate: ({ psu, case: pcCase }) => {
      const psuFormat = psu?.psu_form_factor;
      const supported = pcCase?.supported_psu_form_factors;
      if (!psuFormat || !Array.isArray(supported) || supported.length === 0) return null;
      return !supported.includes(psuFormat)
        ? `PSU form factor (${psuFormat}) not supported by case. Accepted: ${supported.join(', ')}.`
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

  const singleSlotKeys: string[] = ['cpu', 'motherboard', 'gpu', 'cooling'];
  let total_tdp = singleSlotKeys.reduce((sum, key) => sum + ((build[key] as any)?.tdp ?? 0), 0);
  
  // Add base load (MB/Fans/SSDs)
  if (Object.keys(build).length > 0) total_tdp += 50;

  for (const ram of getRamComponents(build)) {
    total_tdp += (ram as any).tdp ?? 0;
  }
  for (const storage of getStorageComponents(build)) {
    total_tdp += (storage as any).tdp ?? 0;
  }

  const recommended_psu_wattage = Math.ceil((total_tdp * 1.5) / 50) * 50;

  if (build.psu?.wattage && build.psu.wattage < total_tdp) {
    errors.push({
      rule: 'psu_underpowered',
      components: ['psu'],
      message: `Estimated load (${total_tdp}W) exceeds PSU capacity (${build.psu.wattage}W).`,
    });
  } else if (build.psu?.wattage && build.psu.wattage < total_tdp * 1.1) {
      warnings.push({
          rule: 'psu_tight',
          components: ['psu'],
          message: `PSU capacity (${build.psu.wattage}W) is very close to estimated load (${total_tdp}W).`,
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
