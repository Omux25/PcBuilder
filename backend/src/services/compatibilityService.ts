/**
 * Compatibility Engine — Business Logic
 * Validates a PC build configuration against 8 compatibility rules.
 *
 * Rule 1: socket_mismatch        — error   (CPU + Motherboard)
 * Rule 2: ram_type_mismatch      — error   (RAM + Motherboard)
 * Rule 3: ram_frequency_exceeded — warning (RAM + Motherboard)
 * Rule 4: gpu_too_long           — error   (GPU + Case)
 * Rule 5: form_factor_mismatch   — error   (Motherboard + Case)
 * Rule 6: cooler_too_tall        — error   (Cooling + Case)
 * Rule 7: TDP calculation        — always  (cpu, motherboard, gpu, ram, storage, case, cooling — PSU excluded)
 * Rule 8: psu_underpowered       — warning (PSU)
 *
 * Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3
 */

/**
 * Validates a build object and returns a compatibility result.
 *
 * @param {Object} build - The build configuration
 * @param {Object} [build.cpu]         - { socket, tdp, ... }
 * @param {Object} [build.motherboard] - { socket, supported_ram_types, max_ram_frequency, form_factor, tdp, ... }
 * @param {Object} [build.gpu]         - { length_mm, tdp, ... }
 * @param {Object} [build.ram]         - { ram_type, frequency_mhz, tdp, ... }
 * @param {Object} [build.storage]     - { tdp, ... }
 * @param {Object} [build.psu]         - { wattage, ... }
 * @param {Object} [build.case]        - { max_gpu_length_mm, supported_motherboards, max_cooler_height_mm, ... }
 * @param {Object} [build.cooling]     - { height_mm, tdp, ... }
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
  cpu?: { socket: string; tdp?: number | null; specs?: Record<string, unknown> };
  motherboard?: {
    socket: string;
    supported_ram_types: string[];
    max_ram_frequency: number;
    tdp?: number | null;
    form_factor?: string;
    specs?: Record<string, unknown>;
  };
  gpu?: { length_mm: number; tdp?: number | null; specs?: Record<string, unknown> };
  ram?: { ram_type: string; frequency_mhz: number; tdp?: number | null; specs?: Record<string, unknown> };
  storage?: { tdp?: number | null; specs?: Record<string, unknown> };
  psu?: { wattage: number; tdp?: number | null; specs?: Record<string, unknown> };
  case?: {
    max_gpu_length_mm: number;
    tdp?: number | null;
    supported_motherboards?: string[];
    max_cooler_height_mm?: number;
    specs?: Record<string, unknown>;
  };
  cooling?: { height_mm?: number; supported_sockets?: string[]; tdp?: number | null; specs?: Record<string, unknown> };
}) {
  const errors = [];
  const warnings = [];

  const { cpu, motherboard, gpu, ram, storage, psu, cooling } = build;
  const pcCase = build.case;

  // Rule 1 — socket_mismatch (error)
  if (cpu && motherboard) {
    if (cpu.socket !== motherboard.socket) {
      errors.push({
        rule: 'socket_mismatch',
        components: ['cpu', 'motherboard'],
        message: `CPU socket (${cpu.socket}) is not compatible with motherboard socket (${motherboard.socket}).`,
      });
    }
  }

  // Rule 2 — ram_type_mismatch (error)
  if (ram && motherboard) {
    if (!motherboard.supported_ram_types.includes(ram.ram_type)) {
      errors.push({
        rule: 'ram_type_mismatch',
        components: ['ram', 'motherboard'],
        message: `RAM type (${ram.ram_type}) is not supported by this motherboard. Supported types: ${motherboard.supported_ram_types.join(', ')}.`,
      });
    }
  }

  // Rule 3 — ram_frequency_exceeded (warning)
  if (ram && motherboard) {
    if (ram.frequency_mhz > motherboard.max_ram_frequency) {
      warnings.push({
        rule: 'ram_frequency_exceeded',
        components: ['ram', 'motherboard'],
        message: `RAM frequency (${ram.frequency_mhz} MHz) exceeds the motherboard maximum (${motherboard.max_ram_frequency} MHz). RAM will run at ${motherboard.max_ram_frequency} MHz.`,
      });
    }
  }

  // Rule 4 — gpu_too_long (error)
  if (gpu && pcCase) {
    if (gpu.length_mm > pcCase.max_gpu_length_mm) {
      errors.push({
        rule: 'gpu_too_long',
        components: ['gpu', 'case'],
        message: `GPU length (${gpu.length_mm} mm) exceeds the available space in the case (${pcCase.max_gpu_length_mm} mm).`,
      });
    }
  }

  // Rule 5 — form_factor_mismatch (error)
  if (motherboard && pcCase) {
    const mbSpecs = motherboard.specs || {};
    const mbFormFactor = motherboard.form_factor || mbSpecs.form_factor;

    const caseSpecs = pcCase.specs || {};
    const caseSupported = pcCase.supported_motherboards || caseSpecs.supported_motherboards;

    if (mbFormFactor && Array.isArray(caseSupported)) {
      if (!caseSupported.includes(mbFormFactor)) {
        errors.push({
          rule: 'form_factor_mismatch',
          components: ['motherboard', 'case'],
          message: `Motherboard form factor (${mbFormFactor}) is not supported by this case. Supported formats: ${caseSupported.join(', ')}.`,
        });
      }
    }
  }

  // Rule 6 — cooler_too_tall (error)
  if (cooling && pcCase) {
    const coolerSpecs = cooling.specs || {};
    const coolerHeight = cooling.height_mm || coolerSpecs.height_mm;

    const caseSpecs = pcCase.specs || {};
    const maxCoolerHeight = pcCase.max_cooler_height_mm || caseSpecs.max_cooler_height_mm;

    if (coolerHeight && maxCoolerHeight && coolerHeight > maxCoolerHeight) {
      errors.push({
        rule: 'cooler_too_tall',
        components: ['cooling', 'case'],
        message: `CPU cooler height (${coolerHeight} mm) exceeds the case maximum (${maxCoolerHeight} mm).`,
      });
    }
  }

  // Rule 7 — TDP calculation
  // PSU is excluded from the sum: it supplies power, it doesn't consume it
  // (its own idle draw is negligible and already factored into efficiency ratings).
  const componentKeys = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'case', 'cooling'] as const;
  const total_tdp = componentKeys.reduce((sum, key) => {
    const component = build[key];
    return sum + (component && component.tdp != null ? component.tdp : 0);
  }, 0);

  const recommended_psu_wattage = Math.ceil(total_tdp * 1.5);

  // Rule 8 — psu_underpowered (warning)
  if (psu) {
    if (psu.wattage < recommended_psu_wattage) {
      warnings.push({
        rule: 'psu_underpowered',
        components: ['psu'],
        message: `PSU wattage (${psu.wattage} W) is below the recommended minimum (${recommended_psu_wattage} W).`,
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
