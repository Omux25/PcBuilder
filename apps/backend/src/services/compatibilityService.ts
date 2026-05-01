/**
 * Compatibility Engine — Refactored Modular Logic
 * Validates a PC build configuration against a set of extensible rules.
 */

import type { CompatibilityIssue, CompatibilityResult, Component } from '@shared/types';

export interface BuildInput {
  cpu?: Partial<Component>;
  motherboard?: Partial<Component>;
  gpu?: Partial<Component>;
  ram?: Partial<Component>;
  storage?: Partial<Component>;
  psu?: Partial<Component>;
  case?: Partial<Component>;
  cooling?: Partial<Component>;
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
        : null
  },
  {
    name: 'ram_type_mismatch',
    type: 'error',
    components: ['ram', 'motherboard'],
    validate: ({ ram, motherboard }) =>
      (ram?.ram_type && motherboard?.supported_ram_types && !motherboard.supported_ram_types.includes(ram.ram_type))
        ? `RAM type (${ram.ram_type}) not supported by motherboard.`
        : null
  },
  {
    name: 'ram_frequency_exceeded',
    type: 'warning',
    components: ['ram', 'motherboard'],
    validate: ({ ram, motherboard }) =>
      (ram?.frequency_mhz && motherboard?.max_ram_frequency && ram.frequency_mhz > motherboard.max_ram_frequency)
        ? `RAM (${ram.frequency_mhz}MHz) exceeds motherboard max (${motherboard.max_ram_frequency}MHz).`
        : null
  },
  {
    name: 'gpu_too_long',
    type: 'error',
    components: ['gpu', 'case'],
    validate: ({ gpu, case: pcCase }) =>
      (gpu?.length_mm && pcCase?.max_gpu_length_mm && gpu.length_mm > pcCase.max_gpu_length_mm)
        ? `GPU (${gpu.length_mm}mm) too long for case (${pcCase.max_gpu_length_mm}mm).`
        : null
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
    }
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
    }
  }
];

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

  // Calculate TDP
  const tdpComponents: Array<keyof BuildInput> = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'cooling'];
  const total_tdp = tdpComponents.reduce((sum, key) => sum + (build[key]?.tdp ?? 0), 0);
  const recommended_psu_wattage = Math.ceil(total_tdp * 1.5);

  // PSU Rule (Calculated)
  if (build.psu?.wattage && build.psu.wattage < recommended_psu_wattage) {
    warnings.push({
      rule: 'psu_underpowered',
      components: ['psu'],
      message: `PSU (${build.psu.wattage}W) below recommended minimum (${recommended_psu_wattage}W).`
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
