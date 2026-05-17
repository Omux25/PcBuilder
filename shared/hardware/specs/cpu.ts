interface CpuModelStats {
  cores: number;
  threads: number;
  base?: number;
  boost?: number;
}

const COMMON_CPU_STATS: Record<string, CpuModelStats> = {
  // AMD Ryzen 9
  '9950X3D': { cores: 16, threads: 32, base: 4.2, boost: 5.7 },
  '9950X': { cores: 16, threads: 32, base: 4.3, boost: 5.7 },
  '9900X': { cores: 12, threads: 24, base: 4.4, boost: 5.6 },
  '7950X3D': { cores: 16, threads: 32, base: 4.2, boost: 5.7 },
  '7950X': { cores: 16, threads: 32, base: 4.5, boost: 5.7 },
  '7900X3D': { cores: 12, threads: 24, base: 4.4, boost: 5.6 },
  '7900X': { cores: 12, threads: 24, base: 4.7, boost: 5.6 },
  '7900': { cores: 12, threads: 24, base: 3.7, boost: 5.4 },
  '5950X': { cores: 16, threads: 32, base: 3.4, boost: 4.9 },
  '5900X': { cores: 12, threads: 24, base: 3.7, boost: 4.8 },
  '3950X': { cores: 16, threads: 32, base: 3.5, boost: 4.7 },
  '3900X': { cores: 12, threads: 24, base: 3.8, boost: 4.6 },

  // AMD Ryzen 7
  '9850X3D': { cores: 8, threads: 16, base: 4.7, boost: 5.6 },
  '9800X3D': { cores: 8, threads: 16, base: 4.7, boost: 5.2 },
  '9700X': { cores: 8, threads: 16, base: 3.8, boost: 5.5 },
  '7800X3D': { cores: 8, threads: 16, base: 4.2, boost: 5.0 },
  '7700X': { cores: 8, threads: 16, base: 4.5, boost: 5.4 },
  '7700': { cores: 8, threads: 16, base: 3.8, boost: 5.3 },
  '5800X3D': { cores: 8, threads: 16, base: 3.4, boost: 4.5 },
  '5800X': { cores: 8, threads: 16, base: 3.8, boost: 4.7 },
  '5700X3D': { cores: 8, threads: 16, base: 3.0, boost: 4.1 },
  '5700X': { cores: 8, threads: 16, base: 3.4, boost: 4.6 },
  '5700G': { cores: 8, threads: 16, base: 3.8, boost: 4.6 },
  '3800X': { cores: 8, threads: 16, base: 3.9, boost: 4.5 },
  '3700X': { cores: 8, threads: 16, base: 3.6, boost: 4.4 },

  // AMD Ryzen 5
  '9600X': { cores: 6, threads: 12, base: 3.9, boost: 5.4 },
  '8600G': { cores: 6, threads: 12, base: 4.3, boost: 5.0 },
  '8500G': { cores: 6, threads: 12, base: 3.5, boost: 5.0 },
  '8400F': { cores: 6, threads: 12, base: 4.2, boost: 4.7 },
  '7600X3D': { cores: 6, threads: 12, base: 4.1, boost: 4.7 },
  '7600X': { cores: 6, threads: 12, base: 4.7, boost: 5.3 },
  '7600': { cores: 6, threads: 12, base: 3.8, boost: 5.1 },
  '7500X3D': { cores: 6, threads: 12, base: 3.3, boost: 5.0 },
  '7500F': { cores: 6, threads: 12, base: 3.7, boost: 5.0 },
  '5650G': { cores: 6, threads: 12, base: 3.9, boost: 4.4 },
  '5655G': { cores: 6, threads: 12, base: 3.9, boost: 4.4 },
  '5600X': { cores: 6, threads: 12, base: 3.7, boost: 4.6 },
  '5600G': { cores: 6, threads: 12, base: 3.9, boost: 4.4 },
  '5600': { cores: 6, threads: 12, base: 3.5, boost: 4.4 },
  '5500GT': { cores: 6, threads: 12, base: 3.6, boost: 4.4 },
  '5500': { cores: 6, threads: 12, base: 3.6, boost: 4.2 },
  '4650G': { cores: 6, threads: 12, base: 3.7, boost: 4.2 },
  '4600G': { cores: 6, threads: 12, base: 3.7, boost: 4.2 },
  '4500': { cores: 6, threads: 12, base: 3.6, boost: 4.1 },
  '3600X': { cores: 6, threads: 12, base: 3.8, boost: 4.4 },
  '3600': { cores: 6, threads: 12, base: 3.6, boost: 4.2 },
  '3500X': { cores: 6, threads: 6, base: 3.6, boost: 4.1 },
  '3400G': { cores: 4, threads: 8, base: 3.7, boost: 4.2 },
  '2600X': { cores: 6, threads: 12, base: 3.6, boost: 4.2 },
  '2600': { cores: 6, threads: 12, base: 3.4, boost: 3.9 },
  '2400G': { cores: 4, threads: 8, base: 3.6, boost: 3.9 },

  // AMD Ryzen 3
  '5350G': { cores: 4, threads: 8, base: 4.0, boost: 4.2 },
  '4300G': { cores: 4, threads: 8, base: 3.8, boost: 4.0 },
  '4100': { cores: 4, threads: 8, base: 3.8, boost: 4.0 },
  '3300X': { cores: 4, threads: 8, base: 3.8, boost: 4.3 },
  '3200G': { cores: 4, threads: 4, base: 3.6, boost: 4.0 },
  '3100': { cores: 4, threads: 8, base: 3.6, boost: 3.9 },
  '2200G': { cores: 4, threads: 4, base: 3.5, boost: 3.7 },
  '1200': { cores: 4, threads: 4, base: 3.1, boost: 3.4 },

  // AMD Threadripper PRO
  '7995WX': { cores: 96, threads: 192, base: 2.5, boost: 5.1 },
  '7985WX': { cores: 64, threads: 128, base: 3.2, boost: 5.1 },
  '7975WX': { cores: 32, threads: 64, base: 4.0, boost: 5.3 },
  '7965WX': { cores: 24, threads: 48, base: 4.2, boost: 5.3 },
  '5995WX': { cores: 64, threads: 128, base: 2.7, boost: 4.5 },
  '5975WX': { cores: 32, threads: 64, base: 3.6, boost: 4.5 },
  '3995WX': { cores: 64, threads: 128, base: 2.7, boost: 4.2 },
  '3975WX': { cores: 32, threads: 64, base: 3.5, boost: 4.2 },
  '3955WX': { cores: 16, threads: 32, base: 3.9, boost: 4.3 },

  // Intel Core i9
  '14900KS': { cores: 24, threads: 32, base: 3.2, boost: 6.2 },
  '14900K': { cores: 24, threads: 32, base: 3.2, boost: 6.0 },
  '14900F': { cores: 24, threads: 32, base: 2.0, boost: 5.8 },
  '14900': { cores: 24, threads: 32, base: 2.0, boost: 5.8 },
  '13900KS': { cores: 24, threads: 32, base: 3.2, boost: 6.0 },
  '13900K': { cores: 24, threads: 32, base: 3.0, boost: 5.8 },
  '13900F': { cores: 24, threads: 32, base: 2.0, boost: 5.6 },
  '13900': { cores: 24, threads: 32, base: 2.0, boost: 5.6 },
  '12900KS': { cores: 16, threads: 24, base: 3.4, boost: 5.5 },
  '12900K': { cores: 16, threads: 24, base: 3.2, boost: 5.2 },
  '12900F': { cores: 16, threads: 24, base: 2.4, boost: 5.1 },
  '12900': { cores: 16, threads: 24, base: 2.4, boost: 5.1 },
  '11900K': { cores: 8, threads: 16, base: 3.5, boost: 5.3 },
  '10900K': { cores: 10, threads: 20, base: 3.7, boost: 5.3 },

  // Intel Core i7
  '14700K': { cores: 20, threads: 28, base: 3.4, boost: 5.6 },
  '14700F': { cores: 20, threads: 28, base: 2.1, boost: 5.4 },
  '14700': { cores: 20, threads: 28, base: 2.1, boost: 5.4 },
  '13700K': { cores: 16, threads: 24, base: 3.4, boost: 5.4 },
  '13700F': { cores: 16, threads: 24, base: 2.1, boost: 5.2 },
  '13700': { cores: 16, threads: 24, base: 2.1, boost: 5.2 },
  '12700K': { cores: 12, threads: 20, base: 3.6, boost: 5.0 },
  '12700F': { cores: 12, threads: 20, base: 2.1, boost: 4.9 },
  '12700': { cores: 12, threads: 20, base: 2.1, boost: 4.9 },

  // Intel Core i5
  '14600K': { cores: 14, threads: 20, base: 3.5, boost: 5.3 },
  '14500': { cores: 14, threads: 20, base: 2.6, boost: 5.0 },
  '14400F': { cores: 10, threads: 16, base: 2.5, boost: 4.7 },
  '14400': { cores: 10, threads: 16, base: 2.5, boost: 4.7 },
  '13600K': { cores: 14, threads: 20, base: 3.5, boost: 5.1 },
  '13500': { cores: 14, threads: 20, base: 2.5, boost: 4.8 },
  '13400F': { cores: 10, threads: 16, base: 2.5, boost: 4.6 },
  '13400': { cores: 10, threads: 16, base: 2.5, boost: 4.6 },
  '12600K': { cores: 10, threads: 16, base: 3.7, boost: 4.9 },
  '12600': { cores: 6, threads: 12, base: 3.3, boost: 4.8 },
  '12500': { cores: 6, threads: 12, base: 3.0, boost: 4.6 },
  '12400F': { cores: 6, threads: 12, base: 2.5, boost: 4.4 },
  '12400': { cores: 6, threads: 12, base: 2.5, boost: 4.4 },
  '11600K': { cores: 6, threads: 12, base: 3.9, boost: 4.9 },
  '11400F': { cores: 6, threads: 12, base: 2.6, boost: 4.4 },
  '10600K': { cores: 6, threads: 12, base: 4.1, boost: 4.8 },
  '10400F': { cores: 6, threads: 12, base: 2.9, boost: 4.3 },
  '9600K': { cores: 6, threads: 6, base: 3.7, boost: 4.6 },
  '9400F': { cores: 6, threads: 6, base: 2.9, boost: 4.1 },

  // Intel Core i3
  '14100F': { cores: 4, threads: 8, base: 3.5, boost: 4.7 },
  '14100': { cores: 4, threads: 8, base: 3.5, boost: 4.7 },
  '13100F': { cores: 4, threads: 8, base: 3.4, boost: 4.5 },
  '13100': { cores: 4, threads: 8, base: 3.4, boost: 4.5 },
  '12100F': { cores: 4, threads: 8, base: 3.3, boost: 4.3 },
  '12100': { cores: 4, threads: 8, base: 3.3, boost: 4.3 },
  '10105F': { cores: 4, threads: 8, base: 3.7, boost: 4.4 },
  '10100F': { cores: 4, threads: 8, base: 3.6, boost: 4.3 },

  // Intel Core Ultra (Series 2)
  '285K': { cores: 24, threads: 24, base: 3.7, boost: 5.7 },
  '285T': { cores: 24, threads: 24, base: 1.4, boost: 5.4 },
  '285': { cores: 24, threads: 24, base: 2.5, boost: 5.6 },
  '265KF': { cores: 20, threads: 20, base: 3.9, boost: 5.4 },
  '265K': { cores: 20, threads: 20, base: 3.9, boost: 5.5 },
  '245KF': { cores: 14, threads: 14, base: 4.2, boost: 5.2 },
  '245K': { cores: 14, threads: 14, base: 4.2, boost: 5.2 },
  '225F': { cores: 10, threads: 10, base: 3.3, boost: 4.9 },
  '225': { cores: 10, threads: 10, base: 3.3, boost: 4.9 },
};

// Sort common models by length descending to match most specific first (e.g. 7600X before 7600)
const SORTED_MODELS = Object.keys(COMMON_CPU_STATS).sort((a, b) => b.length - a.length);

export const extractCpuSpecs = (n: string) => {
  const upper = n.toUpperCase();
  const lower = n.toLowerCase();
  
  const socketMatch = n.match(/\b(LGA\s*1700|LGA\s*1851|AM[45]|LGA\s*1200|LGA\s*1151)\b/i);
  const tdpMatch = n.match(/\b(\d+)\s*W\b/i);

  // Infer socket
  let socket = socketMatch ? socketMatch[1].toUpperCase().replace(/\s+/, '') : null;
  if (!socket) {
    if (lower.match(/ryzen\s+[3579]\s+[789]\d{3}/) || lower.match(/ryzen\s+ai\s+3\d{2}/) || lower.match(/ryzen\s+[3579]\s+pro\s+[789]\d{3}/)) socket = 'AM5';
    else if (lower.match(/ryzen\s+[3579]\s+[1-5]\d{3}/) || lower.match(/athlon\s+3\d{3}g/) || lower.match(/ryzen\s+[3579]\s+pro\s+[1-5]\d{3}/)) socket = 'AM4';
    else if (lower.match(/(core\s+ultra\s+\d+|ultra\s+\d+)\s+2\d{2}[a-z]*/)) socket = 'LGA1851';
    else if (lower.match(/(core\s+ultra\s+\d+|ultra\s+\d+)\s+1\d{2}[a-z]*/) || lower.match(/(core\s+)?([iu]\d)[-\s]+1[234]\d{3}/)) socket = 'LGA1700';
    else if (lower.match(/(core\s+)?([iu]\d)[-\s]+1[01]\d{3}/)) socket = 'LGA1200';
    else if (lower.match(/(core\s+)?([iu]\d)[-\s]+[89]\d{3}/)) socket = 'LGA1151';
    else if (lower.match(/threadripper\s+pro\s+7\d{3}/)) socket = 'sTR5';
    else if (lower.match(/threadripper\s+pro\s+[35]\d{3}/)) socket = 'sWRX8';
    else if (lower.match(/threadripper\s+[57]\d{3}/)) socket = 'sTR5';
    else if (lower.match(/threadripper\s+[34]\d{3}/)) socket = 'sTRX4';
  }

  let supported_ram_types: string[] | null = null;
  if (socket === 'AM4' || socket === 'LGA1200' || socket === 'LGA1151' || socket === 'sWRX8' || socket === 'sTRX4') supported_ram_types = ['DDR4'];
  else if (socket === 'AM5' || socket === 'LGA1851' || socket === 'sTR5') supported_ram_types = ['DDR5'];
  else if (socket === 'LGA1700') supported_ram_types = ['DDR4', 'DDR5'];

  // Extraction from name
  const coreMatch = n.match(/\b(\d+)\s*(?:cores|coeurs)\b/i);
  let core_count = coreMatch ? parseInt(coreMatch[1]) : null;

  const ghzMatches = [...n.matchAll(/(\d+\.\d+)\s*ghz/gi)];
  let base_clock_ghz: number | null = null;
  let boost_clock_ghz: number | null = null;

  if (ghzMatches.length >= 2) {
    base_clock_ghz = parseFloat(ghzMatches[0][1]);
    boost_clock_ghz = parseFloat(ghzMatches[1][1]);
  } else if (ghzMatches.length === 1) {
    boost_clock_ghz = parseFloat(ghzMatches[0][1]);
  }

  // Model-based lookup for missing stats
  let thread_count: number | null = null;
  
  for (const model of SORTED_MODELS) {
    if (upper.includes(model)) {
      const stats = COMMON_CPU_STATS[model];
      if (!core_count) core_count = stats.cores;
      if (!thread_count) thread_count = stats.threads;
      if (!base_clock_ghz && stats.base) base_clock_ghz = stats.base;
      if (!boost_clock_ghz && stats.boost) boost_clock_ghz = stats.boost;
      break;
    }
  }

  // Final fallbacks
  if (core_count && !thread_count) {
     thread_count = core_count * 2;
  }

  return {
    socket,
    supported_ram_types,
    core_count,
    thread_count,
    base_clock_ghz,
    boost_clock_ghz,
    tdp: tdpMatch ? parseInt(tdpMatch[1]) : null
  };
};
