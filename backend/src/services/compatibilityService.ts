/**
 * Compatibility Engine — Business Logic
 * Validates a PC build configuration against six compatibility rules.
 *
 * Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3
 */

/**
 * Validates a build object and returns a compatibility result.
 *
 * @param {Object} build - The build configuration
 * @param {Object} [build.cpu]         - { socket, tdp, ... }
 * @param {Object} [build.motherboard] - { socket, supported_ram_types, max_ram_frequency, tdp, ... }
 * @param {Object} [build.gpu]         - { length_mm, tdp, ... }
 * @param {Object} [build.ram]         - { ram_type, frequency_mhz, tdp, ... }
 * @param {Object} [build.storage]     - { tdp, ... }
 * @param {Object} [build.psu]         - { wattage, tdp, ... }
 * @param {Object} [build.case]        - { max_gpu_length_mm, tdp, ... }
 *
 * @returns {{
 *   compatible: boolean,
 *   total_tdp: number,
 *   recommended_psu_wattage: number,
 *   errors: Array<{ rule: string, components: string[], message: string }>,
 *   warnings: Array<{ rule: string, components: string[], message: string }>
 * }}
 */
function validateCompatibility(build: {
  cpu?: { socket: string; tdp?: number | null };
  motherboard?: { socket: string; supported_ram_types: string[]; max_ram_frequency: number; tdp?: number | null };
  gpu?: { length_mm: number; tdp?: number | null };
  ram?: { ram_type: string; frequency_mhz: number; tdp?: number | null };
  storage?: { tdp?: number | null };
  psu?: { wattage: number; tdp?: number | null };
  case?: { max_gpu_length_mm: number; tdp?: number | null };
}) {
  const errors = [];
  const warnings = [];

  const { cpu, motherboard, gpu, ram, storage, psu } = build;
  const pcCase = build.case;

  // Rule 1 — socket_mismatch (error)
  if (cpu && motherboard) {
    if (cpu.socket !== motherboard.socket) {
      errors.push({
        rule: 'socket_mismatch',
        components: ['cpu', 'motherboard'],
        message: `Le socket du CPU (${cpu.socket}) est incompatible avec le socket de la carte mère (${motherboard.socket}).`,
      });
    }
  }

  // Rule 2 — ram_type_mismatch (error)
  if (ram && motherboard) {
    if (!motherboard.supported_ram_types.includes(ram.ram_type)) {
      errors.push({
        rule: 'ram_type_mismatch',
        components: ['ram', 'motherboard'],
        message: `Le type de RAM (${ram.ram_type}) n'est pas pris en charge par la carte mère. Types supportés : ${motherboard.supported_ram_types.join(', ')}.`,
      });
    }
  }

  // Rule 3 — ram_frequency_exceeded (warning)
  if (ram && motherboard) {
    if (ram.frequency_mhz > motherboard.max_ram_frequency) {
      warnings.push({
        rule: 'ram_frequency_exceeded',
        components: ['ram', 'motherboard'],
        message: `La fréquence de la RAM (${ram.frequency_mhz} MHz) dépasse le maximum supporté par la carte mère (${motherboard.max_ram_frequency} MHz). La RAM fonctionnera à ${motherboard.max_ram_frequency} MHz.`,
      });
    }
  }

  // Rule 4 — gpu_too_long (error)
  if (gpu && pcCase) {
    if (gpu.length_mm > pcCase.max_gpu_length_mm) {
      errors.push({
        rule: 'gpu_too_long',
        components: ['gpu', 'case'],
        message: `La longueur du GPU (${gpu.length_mm} mm) dépasse l'espace disponible dans le boîtier (${pcCase.max_gpu_length_mm} mm).`,
      });
    }
  }

  // Rule 5 — TDP calculation
  const componentKeys = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case'] as const;
  const total_tdp = componentKeys.reduce((sum, key) => {
    const component = build[key];
    return sum + (component && component.tdp != null ? component.tdp : 0);
  }, 0);

  const recommended_psu_wattage = Math.ceil(total_tdp * 1.2);

  // Rule 6 — psu_underpowered (warning)
  if (psu) {
    if (psu.wattage < recommended_psu_wattage) {
      warnings.push({
        rule: 'psu_underpowered',
        components: ['psu'],
        message: `La puissance de l'alimentation (${psu.wattage} W) est inférieure à la puissance recommandée (${recommended_psu_wattage} W).`,
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

export { validateCompatibility };
