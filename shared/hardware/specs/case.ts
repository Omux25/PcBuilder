export const extractCaseSpecs = (n: string) => {
  const lower = n.toLowerCase();
  
  // GPU Length (handles "GPU: 350mm", "Max GPU: 350mm", or just "350mm" if near GPU keywords)
  const gpuMatch = n.match(/(?:gpu|video\s*card|carte\s*graphique)(?:\s*len[gth]*)?\s*[:\-]??\s*(\d{2,3})\s*mm/i) || 
                   n.match(/\b(\d{3})\s*mm\b/i);
  
  // CPU Cooler Height (handles "CPU: 165mm", "Cooler: 165mm", "Max CPU: 165mm")
  const cpuMatch = n.match(/(?:cpu|cooler|ventirad|refroidisseur)(?:\s+height)?\s*[:\-]??\s*(\d{2,3})\s*mm/i);
  
  // Radiator Support (extracting max radiator size: 240, 280, 360, 420)
  const radMatch = n.match(/(?:radiateur|radiator|watercooling)\s*[:\-]??\s*(\d{3})\s*mm/i) ||
                   n.match(/\b(240|280|360|420)\s*mm\b/i);

  // Form Factors
  const hasEatx = /\b(e-?atx)\b/i.test(lower);
  const hasAtx = /\batx\b/i.test(lower);
  const hasMatx = /\b(matx|micro-?atx)\b/i.test(lower);
  const hasItx = /\b(itx|mini-?itx)\b/i.test(lower);
  
  const formFactors = [];
  if (hasEatx) formFactors.push('E-ATX', 'ATX', 'mATX', 'Mini-ITX');
  else if (hasAtx) formFactors.push('ATX', 'mATX', 'Mini-ITX');
  else if (hasMatx) formFactors.push('mATX', 'Mini-ITX');
  else if (hasItx) formFactors.push('Mini-ITX');
  else if (lower.includes('mini') || lower.includes('micro')) formFactors.push('mATX', 'Mini-ITX');
  else if (lower.includes('tower') || lower.includes('vandal') || lower.includes('ares') || lower.includes('atx') || lower.includes('chassis')) formFactors.push('ATX', 'mATX', 'Mini-ITX');
  else if (lower.includes('case')) formFactors.push('ATX', 'mATX', 'Mini-ITX');
  else formFactors.push('ATX', 'mATX', 'Mini-ITX'); 

  return { 
    max_gpu_length_mm: gpuMatch ? parseInt(gpuMatch[1]) : null,
    max_cooler_height_mm: cpuMatch ? parseInt(cpuMatch[1]) : null,
    max_radiator_size: radMatch ? parseInt(radMatch[1]) : null,
    supported_motherboards: formFactors.length > 0 ? formFactors : null
  };
};
