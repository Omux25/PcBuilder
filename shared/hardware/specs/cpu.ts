export const extractCpuSpecs = (n: string) => {
  const socketMatch = n.match(/\b(LGA\s*1700|LGA\s*1851|AM[45]|LGA\s*1200|LGA\s*1151)\b/i);
  const tdpMatch = n.match(/\b(\d+)\s*W\b/i);

  // Infer socket from CPU model series when not explicit in name
  let socket = socketMatch ? socketMatch[1].toUpperCase().replace(/\s+/, '') : null;
  if (!socket) {
    const lower = n.toLowerCase();
    // AMD AM5: Ryzen 7000/8000/9000 series, Ryzen AI 300, Ryzen PRO 7000+
    if (lower.match(/ryzen\s+[3579]\s+[789]\d{3}/) || lower.match(/ryzen\s+ai\s+3\d{2}/) ||
      lower.match(/ryzen\s+[3579]\s+pro\s+[789]\d{3}/)) socket = 'AM5';
    // AMD AM4: Ryzen 1000-5000 series, Athlon 3000G, Ryzen PRO 3000-5000
    else if (lower.match(/ryzen\s+[3579]\s+[1-5]\d{3}/) || lower.match(/athlon\s+3\d{3}g/) ||
      lower.match(/ryzen\s+[3579]\s+pro\s+[1-5]\d{3}/)) socket = 'AM4';
    // Intel LGA1851: Core Ultra 200 series (Arrow Lake) — 2xx, 265K, 285K, etc.
    else if (lower.match(/(core\s+ultra\s+\d+|ultra\s+\d+)\s+2\d{2}[a-z]*/)) socket = 'LGA1851';
    // Intel LGA1700: Core Ultra 100 series (Meteor Lake) + Core 12th/13th/14th gen
    else if (lower.match(/(core\s+ultra\s+\d+|ultra\s+\d+)\s+1\d{2}[a-z]*/) || lower.match(/(core\s+)?([iu]\d)[-\s]+1[234]\d{3}/)) socket = 'LGA1700';
    // Intel LGA1200: Core 10th/11th gen (10xxx, 11xxx)
    else if (lower.match(/(core\s+)?([iu]\d)[-\s]+1[01]\d{3}/)) socket = 'LGA1200';
    // Intel LGA1151: Core 8th/9th gen (8xxx, 9xxx)
    else if (lower.match(/(core\s+)?([iu]\d)[-\s]+[89]\d{3}/)) socket = 'LGA1151';
    // Threadripper PRO
    else if (lower.match(/threadripper\s+pro\s+7\d{3}/)) socket = 'sTR5';
    else if (lower.match(/threadripper\s+pro\s+[35]\d{3}/)) socket = 'sWRX8';
    // Threadripper
    else if (lower.match(/threadripper\s+[57]\d{3}/)) socket = 'sTR5';
    else if (lower.match(/threadripper\s+[34]\d{3}/)) socket = 'sTRX4';
  }

  let supported_ram_types: string[] | null = null;
  if (socket === 'AM4' || socket === 'LGA1200' || socket === 'LGA1151' || socket === 'sWRX8' || socket === 'sTRX4') {
    supported_ram_types = ['DDR4'];
  } else if (socket === 'AM5' || socket === 'LGA1851' || socket === 'sTR5') {
    supported_ram_types = ['DDR5'];
  } else if (socket === 'LGA1700') {
    supported_ram_types = ['DDR4', 'DDR5'];
  }

  const coreMatch = n.match(/\b(\d+)\s*(?:cores|coeurs)\b/i) || n.match(/([3579])\d{3}/);
  let core_count: number | null = coreMatch ? parseInt(coreMatch[1]) : null;

  // Core count mapping for common Ryzen/Core models if not explicit
  if (!core_count) {
    if (n.includes('5950') || n.includes('3950') || n.includes('7950') || n.includes('9950')) core_count = 16;
    else if (n.includes('5900') || n.includes('3900') || n.includes('7900') || n.includes('9900')) core_count = 12;
    else if (n.includes('5800') || n.includes('3800') || n.includes('7700') || n.includes('9700') || n.includes('5700')) core_count = 8;
    else if (n.includes('5600') || n.includes('3600') || n.includes('7600') || n.includes('9600') || n.includes('5500') || n.includes('4500')) core_count = 6;
    else if (n.includes('12900') || n.includes('13900') || n.includes('14900')) core_count = 24;
    else if (n.includes('12700') || n.includes('13700') || n.includes('14700')) core_count = 16;
  }

  return {
    socket,
    supported_ram_types,
    core_count,
    thread_count: core_count ? core_count * 2 : null,
    tdp: tdpMatch ? parseInt(tdpMatch[1]) : null
  };
};
