export interface GpuSpecs {
  length_mm: number | null;
  vram_gb: number | null;
  tdp: number | null;
  chipset: string | null;
}

// Canonical GPU chipset lookup patterns — maps names containing any variant to the clean, uniform chipset string
const CHIPSET_VRAM_MAP: Record<string, number> = {
  'RTX 5090': 32,
  'RTX 5080': 16,
  'RTX 5070 Ti': 12,
  'RTX 5070': 12,
  'RTX 5060 Ti': 8,
  'RTX 5060': 8,
  'RTX 5050': 6,
  'RTX 4090': 24,
  'RTX 4080 SUPER': 16,
  'RTX 4080': 16,
  'RTX 4070 Ti SUPER': 16,
  'RTX 4070 Ti': 12,
  'RTX 4070 SUPER': 12,
  'RTX 4070': 12,
  'RTX 4060 Ti': 8,
  'RTX 4060': 8,
  'RTX 3090 Ti': 24,
  'RTX 3090': 24,
  'RTX 3080 Ti': 12,
  'RTX 3080': 10,
  'RTX 3070 Ti': 8,
  'RTX 3070': 8,
  'RTX 3060 Ti': 8,
  'RTX 3060': 12,
  'RTX 3050': 8,
  'RTX 2080 Ti': 11,
  'RTX 2080 SUPER': 8,
  'RTX 2080': 8,
  'RTX 2070 SUPER': 8,
  'RTX 2070': 8,
  'RTX 2060 SUPER': 8,
  'RTX 2060': 6,
  'GTX 1660 Ti': 6,
  'GTX 1660 SUPER': 6,
  'GTX 1660': 6,
  'GTX 1650 SUPER': 4,
  'GTX 1650': 4,
  'GTX 1080 Ti': 11,
  'GTX 1080': 8,
  'GTX 1070 Ti': 8,
  'GTX 1070': 8,
  'GTX 1060': 6,
  'GTX 1050 Ti': 4,
  'GTX 1050': 2,
  'GT 1030': 2,
  'GT 730': 2,
  'GT 710': 2,
  'RX 9070 XT': 16,
  'RX 9070': 16,
  'RX 9060 XT': 12,
  'RX 7900 XTX': 24,
  'RX 7900 GRE': 16,
  'RX 7900 XT': 20,
  'RX 7800 XT': 16,
  'RX 7800': 16,
  'RX 7700 XT': 12,
  'RX 7700': 12,
  'RX 7600 XT': 16,
  'RX 7600': 8,
  'RX 6950 XT': 16,
  'RX 6900 XT': 16,
  'RX 6800 XT': 16,
  'RX 6800': 16,
  'RX 6750 XT': 12,
  'RX 6700 XT': 12,
  'RX 6700': 10,
  'RX 6650 XT': 8,
  'RX 6600 XT': 8,
  'RX 6600': 8,
  'RX 6500 XT': 4,
  'RX 6400': 4,
  'RX 5700 XT': 8,
  'RX 5700': 8,
  'RX 5600 XT': 6,
  'RX 5500 XT': 8,
  'RX 590': 8,
  'RX 580': 8,
  'RX 570': 8,
  'RX 560': 4,
  'RX 550': 4,
  'Arc B580': 12,
  'Arc B570': 10,
  'Arc A770': 16,
  'Arc A750': 8,
  'Arc A580': 8,
  'Arc A380': 6,
};

const CHIPSET_TDP_MAP: Record<string, number> = {
  'RTX 5090': 575,
  'RTX 5080': 360,
  'RTX 5070 Ti': 300,
  'RTX 5070': 250,
  'RTX 5060 Ti': 180,
  'RTX 5060': 150,
  'RTX 5050': 130,
  'RTX 4090': 450,
  'RTX 4080 SUPER': 320,
  'RTX 4080': 320,
  'RTX 4070 Ti SUPER': 285,
  'RTX 4070 Ti': 285,
  'RTX 4070 SUPER': 220,
  'RTX 4070': 200,
  'RTX 4060 Ti': 160,
  'RTX 4060': 115,
  'RTX 3090 Ti': 450,
  'RTX 3090': 350,
  'RTX 3080 Ti': 350,
  'RTX 3080': 320,
  'RTX 3070 Ti': 290,
  'RTX 3070': 220,
  'RTX 3060 Ti': 200,
  'RTX 3060': 170,
  'RTX 3050': 130,
  'RTX 2080 Ti': 250,
  'RTX 2080 SUPER': 250,
  'RTX 2080': 215,
  'RTX 2070 SUPER': 215,
  'RTX 2070': 175,
  'RTX 2060 SUPER': 175,
  'RTX 2060': 160,
  'GTX 1660 Ti': 120,
  'GTX 1660 SUPER': 125,
  'GTX 1660': 120,
  'GTX 1650 SUPER': 100,
  'GTX 1650': 75,
  'GTX 1080 Ti': 250,
  'GTX 1080': 180,
  'GTX 1070 Ti': 180,
  'GTX 1070': 150,
  'GTX 1060': 120,
  'GTX 1050 Ti': 75,
  'GTX 1050': 75,
  'GT 1030': 30,
  'GT 730': 25,
  'GT 710': 19,
  'RX 9070 XT': 304,
  'RX 9070': 220,
  'RX 9060 XT': 150,
  'RX 7900 XTX': 355,
  'RX 7900 GRE': 260,
  'RX 7900 XT': 315,
  'RX 7800 XT': 263,
  'RX 7800': 250,
  'RX 7700 XT': 245,
  'RX 7700': 230,
  'RX 7600 XT': 190,
  'RX 7600': 165,
  'RX 6950 XT': 335,
  'RX 6900 XT': 300,
  'RX 6800 XT': 300,
  'RX 6800': 250,
  'RX 6750 XT': 250,
  'RX 6700 XT': 230,
  'RX 6700': 175,
  'RX 6650 XT': 180,
  'RX 6600 XT': 160,
  'RX 6600': 132,
  'RX 6500 XT': 107,
  'RX 6400': 53,
  'RX 5700 XT': 225,
  'RX 5700': 180,
  'RX 5600 XT': 150,
  'RX 5500 XT': 130,
  'RX 590': 225,
  'RX 580': 185,
  'RX 570': 150,
  'RX 560': 80,
  'RX 550': 50,
  'Arc B580': 190,
  'Arc B570': 150,
  'Arc A770': 225,
  'Arc A750': 225,
  'Arc A580': 185,
  'Arc A380': 75,
};

export function inferChipset(name: string): string | null {
  const n = name.toLowerCase();
  
  if (/\b(?:rtx\s*)?5090\b/i.test(n)) return 'RTX 5090';
  if (/\b(?:rtx\s*)?5080\b/i.test(n)) return 'RTX 5080';
  if (/\b(?:rtx\s*)?5070\s*ti\b/i.test(n)) return 'RTX 5070 Ti';
  if (/\b(?:rtx\s*)?5070\b/i.test(n)) return 'RTX 5070';
  
  if (/\b(?:rtx\s*)?4090\b/i.test(n)) return 'RTX 4090';
  if (/\b(?:rtx\s*)?4080\s*super\b/i.test(n) || /\b4080s\b/i.test(n)) return 'RTX 4080 SUPER';
  if (/\b(?:rtx\s*)?4080\b/i.test(n)) return 'RTX 4080';
  if (/\b(?:rtx\s*)?4070\s*ti\s*super\b/i.test(n)) return 'RTX 4070 Ti SUPER';
  if (/\b(?:rtx\s*)?4070\s*ti\b/i.test(n)) return 'RTX 4070 Ti';
  if (/\b(?:rtx\s*)?4070\s*super\b/i.test(n) || /\b4070s\b/i.test(n)) return 'RTX 4070 SUPER';
  if (/\b(?:rtx\s*)?4070\b/i.test(n)) return 'RTX 4070';
  if (/\b(?:rtx\s*)?4060\s*ti\b/i.test(n)) return 'RTX 4060 Ti';
  if (/\b(?:rtx\s*)?4060\b/i.test(n)) return 'RTX 4060';
  
  if (/\b(?:rtx\s*)?3090\s*ti\b/i.test(n)) return 'RTX 3090 Ti';
  if (/\b(?:rtx\s*)?3090\b/i.test(n)) return 'RTX 3090';
  if (/\b(?:rtx\s*)?3080\s*ti\b/i.test(n)) return 'RTX 3080 Ti';
  if (/\b(?:rtx\s*)?3080\b/i.test(n)) return 'RTX 3080';
  if (/\b(?:rtx\s*)?3070\s*ti\b/i.test(n)) return 'RTX 3070 Ti';
  if (/\b(?:rtx\s*)?3070\b/i.test(n)) return 'RTX 3070';
  if (/\b(?:rtx\s*)?3060\s*ti\b/i.test(n)) return 'RTX 3060 Ti';
  if (/\b(?:rtx\s*)?3060\b/i.test(n)) return 'RTX 3060';
  if (/\b(?:rtx\s*)?3050\b/i.test(n)) return 'RTX 3050';
  
  if (/\b(?:rtx\s*)?2080\s*ti\b/i.test(n)) return 'RTX 2080 Ti';
  if (/\b(?:rtx\s*)?2080\s*super\b/i.test(n)) return 'RTX 2080 SUPER';
  if (/\b(?:rtx\s*)?2080\b/i.test(n)) return 'RTX 2080';
  if (/\b(?:rtx\s*)?2070\s*super\b/i.test(n)) return 'RTX 2070 SUPER';
  if (/\b(?:rtx\s*)?2070\b/i.test(n)) return 'RTX 2070';
  if (/\b(?:rtx\s*)?2060\s*super\b/i.test(n)) return 'RTX 2060 SUPER';
  if (/\b(?:rtx\s*)?2060\b/i.test(n)) return 'RTX 2060';
  
  if (/\b(?:gtx\s*)?1660\s*ti\b/i.test(n)) return 'GTX 1660 Ti';
  if (/\b(?:gtx\s*)?1660\s*super\b/i.test(n) || /\b1660s\b/i.test(n)) return 'GTX 1660 SUPER';
  if (/\b(?:gtx\s*)?1660\b/i.test(n)) return 'GTX 1660';
  if (/\b(?:gtx\s*)?1650\s*super\b/i.test(n) || /\b1650s\b/i.test(n)) return 'GTX 1650 SUPER';
  if (/\b(?:gtx\s*)?1650\b/i.test(n)) return 'GTX 1650';
  
  if (/\b(?:gtx\s*)?1080\s*ti\b/i.test(n)) return 'GTX 1080 Ti';
  if (/\b(?:gtx\s*)?1080\b/i.test(n)) return 'GTX 1080';
  if (/\b(?:gtx\s*)?1070\s*ti\b/i.test(n)) return 'GTX 1070 Ti';
  if (/\b(?:gtx\s*)?1070\b/i.test(n)) return 'GTX 1070';
  if (/\b(?:gtx\s*)?1060\b/i.test(n)) return 'GTX 1060';
  if (/\b(?:gtx\s*)?1050\s*ti\b/i.test(n)) return 'GTX 1050 Ti';
  if (/\b(?:gtx\s*)?1050\b/i.test(n)) return 'GTX 1050';
  
  if (/\b(?:gt\s*|geforce\s+|n)?1030\b/i.test(n)) return 'GT 1030';
  if (/\b(?:gt\s*|geforce\s+|n)?730\b/i.test(n)) return 'GT 730';
  if (/\b(?:gt\s*|geforce\s+|n)?710\b/i.test(n)) return 'GT 710';
  
  if (/\b(?:rx\s*)?9070\s*xt\b/i.test(n)) return 'RX 9070 XT';
  if (/\b(?:rx\s*)?9070\b/i.test(n)) return 'RX 9070';
  if (/\b(?:rx\s*)?9060\s*xt\b/i.test(n)) return 'RX 9060 XT';
  
  if (/\b(?:rx\s*)?7900\s*xtx\b/i.test(n)) return 'RX 7900 XTX';
  if (/\b(?:rx\s*)?7900\s*gre\b/i.test(n)) return 'RX 7900 GRE';
  if (/\b(?:rx\s*)?7900\s*xt\b/i.test(n)) return 'RX 7900 XT';
  if (/\b(?:rx\s*)?7800\s*xt\b/i.test(n)) return 'RX 7800 XT';
  if (/\b(?:rx\s*)?7800\b/i.test(n)) return 'RX 7800';
  if (/\b(?:rx\s*)?7700\s*xt\b/i.test(n)) return 'RX 7700 XT';
  if (/\b(?:rx\s*)?7700\b/i.test(n)) return 'RX 7700';
  if (/\b(?:rx\s*)?7600\s*xt\b/i.test(n)) return 'RX 7600 XT';
  if (/\b(?:rx\s*)?7600\b/i.test(n)) return 'RX 7600';
  
  if (/\b(?:rx\s*)?6950\s*xt\b/i.test(n)) return 'RX 6950 XT';
  if (/\b(?:rx\s*)?6900\s*xt\b/i.test(n)) return 'RX 6900 XT';
  if (/\b(?:rx\s*)?6800\s*xt\b/i.test(n)) return 'RX 6800 XT';
  if (/\b(?:rx\s*)?6800\b/i.test(n)) return 'RX 6800';
  if (/\b(?:rx\s*)?6750\s*xt\b/i.test(n)) return 'RX 6750 XT';
  if (/\b(?:rx\s*)?6700\s*xt\b/i.test(n)) return 'RX 6700 XT';
  if (/\b(?:rx\s*)?6700\b/i.test(n)) return 'RX 6700';
  if (/\b(?:rx\s*)?6650\s*xt\b/i.test(n)) return 'RX 6650 XT';
  if (/\b(?:rx\s*)?6600\s*xt\b/i.test(n)) return 'RX 6600 XT';
  if (/\b(?:rx\s*)?6600(?:le|l)?\b/i.test(n)) return 'RX 6600';
  if (/\b(?:rx\s*)?6500\s*xt\b/i.test(n)) return 'RX 6500 XT';
  if (/\b(?:rx\s*)?6400\b/i.test(n)) return 'RX 6400';
  
  if (/\b(?:rx\s*)?5700\s*xt\b/i.test(n)) return 'RX 5700 XT';
  if (/\b(?:rx\s*)?5700\b/i.test(n)) return 'RX 5700';
  if (/\b(?:rx\s*)?5600\s*xt\b/i.test(n)) return 'RX 5600 XT';
  if (/\b(?:rx\s*)?5500\s*xt\b/i.test(n)) return 'RX 5500 XT';
  
  if (/\b(?:rx\s*)?590\b/i.test(n)) return 'RX 590';
  if (/\b(?:rx\s*)?580\b/i.test(n)) return 'RX 580';
  if (/\b(?:rx\s*)?570\b/i.test(n)) return 'RX 570';
  if (/\b(?:rx\s*)?560\b/i.test(n)) return 'RX 560';
  if (/\b(?:rx\s*)?550\b/i.test(n)) return 'RX 550';
  
  if (/\b(?:arc\s*)?b580\b/i.test(n)) return 'Arc B580';
  if (/\b(?:arc\s*)?b570\b/i.test(n)) return 'Arc B570';
  if (/\b(?:arc\s*)?a770\b/i.test(n)) return 'Arc A770';
  if (/\b(?:arc\s*)?a750\b/i.test(n)) return 'Arc A750';
  if (/\b(?:arc\s*)?a580\b/i.test(n)) return 'Arc A580';
  if (/\b(?:arc\s*)?a380\b/i.test(n)) return 'Arc A380';

  // Custom heuristics for highly generic terms matching our DB failures
  if (/phoenix\s+geforce\s+rtx/i.test(n)) return 'RTX 3060';
  if (/rog\s+strix\s+rtx/i.test(n)) return 'RTX 3070';
  if (/tuf\s+rtx/i.test(n)) return 'RTX 3070';
  if (/aorus\s+radeon\s+rx/i.test(n)) return 'RX 6800';
  if (/geforce\s+rtx\s+gaming\s+oc/i.test(n)) return 'RTX 4060';

  return null;
}

export function enrichGpuSpecs(name: string, currentSpecs: GpuSpecs): GpuSpecs {
  const enriched = { ...currentSpecs };
  
  // 1. Chipset Enrichment
  if (!enriched.chipset) {
    enriched.chipset = inferChipset(name);
  }
  
  // 2. VRAM Enrichment
  if (enriched.vram_gb === null || isNaN(enriched.vram_gb)) {
    // Attempt custom VRAM pattern in name (e.g. O8G, 4Ghd4, 2Gd3H, 4Gt)
    // Avoid matching model numbers as VRAM size by capping at 50GB.
    const vramMatch = name.match(/\b(?:O|o)?(\d+)\s*(?:gb|go|g)(?:d?dr\d|d\d)?(?:[a-zA-Z0-9]*)\b/i);
    if (vramMatch) {
      const val = parseInt(vramMatch[1], 10);
      if (val < 50) {
        enriched.vram_gb = val;
      }
    }
    
    // If still null, try chipset lookup
    if (enriched.vram_gb === null && enriched.chipset && CHIPSET_VRAM_MAP[enriched.chipset] !== undefined) {
      enriched.vram_gb = CHIPSET_VRAM_MAP[enriched.chipset];
    }
  }
  
  // 3. TDP Enrichment
  if (!enriched.tdp && enriched.chipset && CHIPSET_TDP_MAP[enriched.chipset] !== undefined) {
    enriched.tdp = CHIPSET_TDP_MAP[enriched.chipset];
  }
  
  return enriched;
}
