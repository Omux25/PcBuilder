import { enrichGpuSpecs } from './enrichment.js';

// Canonical GPU chipset lookup patterns — maps names containing any variant to the clean, uniform chipset string
const CHIPSET_PATTERNS: [RegExp, string][] = [
  // ── NVIDIA RTX 50 series ──────────────────────────────────────────────
  [/\b(?:rtx\s*)?5090\b/i, 'RTX 5090'],
  [/\b(?:rtx\s*)?5080\b/i, 'RTX 5080'],
  [/\b(?:rtx\s*)?5070\s*ti\b/i, 'RTX 5070 Ti'],
  [/\b(?:rtx\s*)?5070\b/i, 'RTX 5070'],
  [/\b(?:rtx\s*)?5060\s*ti\b/i, 'RTX 5060 Ti'],
  [/\b(?:rtx\s*)?5060\b/i, 'RTX 5060'],
  [/\b(?:rtx\s*)?5050\b/i, 'RTX 5050'],

  // ── NVIDIA RTX 40 series ──────────────────────────────────────────────
  [/\b(?:rtx\s*)?4090\b/i, 'RTX 4090'],
  [/\b(?:rtx\s*)?4080\s*super\b/i, 'RTX 4080 SUPER'],
  [/\b(?:rtx\s*)?4080\b/i, 'RTX 4080'],
  [/\b(?:rtx\s*)?4070\s*ti\s*super\b/i, 'RTX 4070 Ti SUPER'],
  [/\b(?:rtx\s*)?4070\s*ti\b/i, 'RTX 4070 Ti'],
  [/\b(?:rtx\s*)?4070\s*super\b/i, 'RTX 4070 SUPER'],
  [/\b(?:rtx\s*)?4070\b/i, 'RTX 4070'],
  [/\b(?:rtx\s*)?4060\s*ti\b/i, 'RTX 4060 Ti'],
  [/\b(?:rtx\s*)?4060\b/i, 'RTX 4060'],

  // ── NVIDIA RTX 30 series ──────────────────────────────────────────────
  [/\b(?:rtx\s*)?3090\s*ti\b/i, 'RTX 3090 Ti'],
  [/\b(?:rtx\s*)?3090\b/i, 'RTX 3090'],
  [/\b(?:rtx\s*)?3080\s*ti\b/i, 'RTX 3080 Ti'],
  [/\b(?:rtx\s*)?3080\b/i, 'RTX 3080'],
  [/\b(?:rtx\s*)?3070\s*ti\b/i, 'RTX 3070 Ti'],
  [/\b(?:rtx\s*)?3070\b/i, 'RTX 3070'],
  [/\b(?:rtx\s*)?3060\s*ti\b/i, 'RTX 3060 Ti'],
  [/\b(?:rtx\s*)?3060\b/i, 'RTX 3060'],
  [/\b(?:rtx\s*)?3050\b/i, 'RTX 3050'],

  // ── NVIDIA RTX 20 series ──────────────────────────────────────────────
  [/\b(?:rtx\s*)?2080\s*ti\b/i, 'RTX 2080 Ti'],
  [/\b(?:rtx\s*)?2080\s*super\b/i, 'RTX 2080 SUPER'],
  [/\b(?:rtx\s*)?2080\b/i, 'RTX 2080'],
  [/\b(?:rtx\s*)?2070\s*super\b/i, 'RTX 2070 SUPER'],
  [/\b(?:rtx\s*)?2070\b/i, 'RTX 2070'],
  [/\b(?:rtx\s*)?2060\s*super\b/i, 'RTX 2060 SUPER'],
  [/\b(?:rtx\s*)?2060\b/i, 'RTX 2060'],

  // ── NVIDIA GTX 16 series ──────────────────────────────────────────────
  [/\b(?:gtx\s*)?1660\s*ti\b/i, 'GTX 1660 Ti'],
  [/\b(?:gtx\s*)?1660\s*super\b/i, 'GTX 1660 SUPER'],
  [/\b(?:gtx\s*)?1660\b/i, 'GTX 1660'],
  [/\b(?:gtx\s*)?1650\s*super\b/i, 'GTX 1650 SUPER'],
  [/\b(?:gtx\s*)?1650\b/i, 'GTX 1650'],

  // ── NVIDIA GTX 10 series ──────────────────────────────────────────────
  [/\b(?:gtx\s*)?1080\s*ti\b/i, 'GTX 1080 Ti'],
  [/\b(?:gtx\s*)?1080\b/i, 'GTX 1080'],
  [/\b(?:gtx\s*)?1070\s*ti\b/i, 'GTX 1070 Ti'],
  [/\b(?:gtx\s*)?1070\b/i, 'GTX 1070'],
  [/\b(?:gtx\s*)?1060\b/i, 'GTX 1060'],
  [/\b(?:gtx\s*)?1050\s*ti\b/i, 'GTX 1050 Ti'],
  [/\b(?:gtx\s*)?1050\b/i, 'GTX 1050'],

  // ── NVIDIA Pro / Quadro series ────────────────────────────────────────
  [/\b(?:rtx\s*)?(?:pro\s*)?6000\b/i, 'RTX 6000'],
  [/\b(?:rtx\s*)?a6000\b/i, 'RTX A6000'],
  [/\b(?:rtx\s*)?a5000\b/i, 'RTX A5000'],
  [/\b(?:rtx\s*)?a4000\b/i, 'RTX A4000'],
  [/\b(?:rtx\s*)?a2000\b/i, 'RTX A2000'],
  [/\bquadro\s*m4000\b/i, 'Quadro M4000'],
  [/\brtx\s*5000\s*(?:ada)?\b/i, 'RTX 5000 Ada'],

  // ── NVIDIA GT series ──────────────────────────────────────────────────
  [/\b(?:gt\s*|geforce\s+|n)?1030\b/i, 'GT 1030'],
  [/\b(?:gt\s*|geforce\s+|n)?730\b/i, 'GT 730'],
  [/\b(?:gt\s*|geforce\s+|n)?710\b/i, 'GT 710'],

  // ── AMD RX 9000 series ────────────────────────────────────────────────
  [/\b(?:rx\s*)?9070\s*xt\b/i, 'RX 9070 XT'],
  [/\b(?:rx\s*)?9070\b/i, 'RX 9070'],
  [/\b(?:rx\s*)?9060\s*xt\b/i, 'RX 9060 XT'],

  // ── AMD RX 7000 series ────────────────────────────────────────────────
  [/\b(?:rx\s*)?7900\s*xtx\b/i, 'RX 7900 XTX'],
  [/\b(?:rx\s*)?7900\s*gre\b/i, 'RX 7900 GRE'],
  [/\b(?:rx\s*)?7900\s*xt\b/i, 'RX 7900 XT'],
  [/\b(?:rx\s*)?7800\s*xt\b/i, 'RX 7800 XT'],
  [/\b(?:rx\s*)?7800\b/i, 'RX 7800'],
  [/\b(?:rx\s*)?7700\s*xt\b/i, 'RX 7700 XT'],
  [/\b(?:rx\s*)?7700\b/i, 'RX 7700'],
  [/\b(?:rx\s*)?7600\s*xt\b/i, 'RX 7600 XT'],
  [/\b(?:rx\s*)?7600\b/i, 'RX 7600'],

  // ── AMD RX 6000 series ────────────────────────────────────────────────
  [/\b(?:rx\s*)?6950\s*xt\b/i, 'RX 6950 XT'],
  [/\b(?:rx\s*)?6900\s*xt\b/i, 'RX 6900 XT'],
  [/\b(?:rx\s*)?6800\s*xt\b/i, 'RX 6800 XT'],
  [/\b(?:rx\s*)?6800\b/i, 'RX 6800'],
  [/\b(?:rx\s*)?6750\s*xt\b/i, 'RX 6750 XT'],
  [/\b(?:rx\s*)?6700\s*xt\b/i, 'RX 6700 XT'],
  [/\b(?:rx\s*)?6700\b/i, 'RX 6700'],
  [/\b(?:rx\s*)?6650\s*xt\b/i, 'RX 6650 XT'],
  [/\b(?:rx\s*)?6600\s*xt\b/i, 'RX 6600 XT'],
  [/\b(?:rx\s*)?6600\b/i, 'RX 6600'],
  [/\b(?:rx\s*)?6500\s*xt\b/i, 'RX 6500 XT'],
  [/\b(?:rx\s*)?6400\b/i, 'RX 6400'],

  // ── AMD RX 5000 series ────────────────────────────────────────────────
  [/\b(?:rx\s*)?5700\s*xt\b/i, 'RX 5700 XT'],
  [/\b(?:rx\s*)?5700\b/i, 'RX 5700'],
  [/\b(?:rx\s*)?5600\s*xt\b/i, 'RX 5600 XT'],
  [/\b(?:rx\s*)?5500\s*xt\b/i, 'RX 5500 XT'],

  // ── AMD RX 500 series ─────────────────────────────────────────────────
  [/\b(?:rx\s*)?590\b/i, 'RX 590'],
  [/\b(?:rx\s*)?580\b/i, 'RX 580'],
  [/\b(?:rx\s*)?570\b/i, 'RX 570'],
  [/\b(?:rx\s*)?560\b/i, 'RX 560'],
  [/\b(?:rx\s*)?550\b/i, 'RX 550'],
  [/\b(?:rx\s*)?550\b/i, 'RX 550'],
  
  // Custom shorthand fallbacks (like "Rx550")
  [/\brx\s*550\b/i, 'RX 550'],
  [/\brx\s*560\b/i, 'RX 560'],
  [/\brx\s*570\b/i, 'RX 570'],
  [/\brx\s*580\b/i, 'RX 580'],
  [/\brx\s*590\b/i, 'RX 590'],

  // ── Intel Arc ─────────────────────────────────────────────────────────
  [/\b(?:arc\s*)?b580\b/i, 'Arc B580'],
  [/\b(?:arc\s*)?b570\b/i, 'Arc B570'],
  [/\b(?:arc\s*)?a770\b/i, 'Arc A770'],
  [/\b(?:arc\s*)?a750\b/i, 'Arc A750'],
  [/\b(?:arc\s*)?a580\b/i, 'Arc A580'],
  [/\b(?:arc\s*)?a380\b/i, 'Arc A380'],
];

export const extractGpuSpecs = (n: string) => {
  const lengthMatch = n.match(/\b(\d{3})\s*mm\b/i);
  const vramMatch = n.match(/\b(\d+)\s*(?:gb|go|g)\s*(?:d?dr\d|d\d)?\b/i);
  const vramTypeMatch = n.match(/\b(GDDR[567]X?|HBM\d?|DDR[345])\b/i);

  // TDP lookup by GPU chipset — official NVIDIA/AMD TDP values (board power)
  // Ordered longest-match first to avoid "4070" matching "4070 Ti Super"
  const GPU_TDP: [RegExp, number][] = [
    // ── NVIDIA RTX 50 series ──────────────────────────────────────────────
    [/(?:rtx\s*)?5090/i, 575],
    [/(?:rtx\s*)?5080/i, 360],
    [/(?:rtx\s*)?5070\s*ti/i, 300],
    [/(?:rtx\s*)?5070/i, 250],
    [/(?:rtx\s*)?5060\s*ti/i, 180],
    [/(?:rtx\s*)?5060/i, 150],
    [/(?:rtx\s*)?5050/i, 130],
    // ── NVIDIA RTX 40 series ──────────────────────────────────────────────
    [/(?:rtx\s*)?4090/i, 450],
    [/(?:rtx\s*)?4080\s*super/i, 320],
    [/(?:rtx\s*)?4080/i, 320],
    [/(?:rtx\s*)?4070\s*ti\s*super/i, 285],
    [/(?:rtx\s*)?4070\s*ti/i, 285],
    [/(?:rtx\s*)?4070\s*super/i, 220],
    [/(?:rtx\s*)?4070/i, 200],
    [/(?:rtx\s*)?4060\s*ti/i, 160],
    [/(?:rtx\s*)?4060/i, 115],
    // ── NVIDIA RTX 30 series ──────────────────────────────────────────────
    [/(?:rtx\s*)?3090\s*ti/i, 450],
    [/(?:rtx\s*)?3090/i, 350],
    [/(?:rtx\s*)?3080\s*ti/i, 350],
    [/(?:rtx\s*)?3080/i, 320],
    [/(?:rtx\s*)?3070\s*ti/i, 290],
    [/(?:rtx\s*)?3070/i, 220],
    [/(?:rtx\s*)?3060\s*ti/i, 200],
    [/(?:rtx\s*)?3060/i, 170],
    [/(?:rtx\s*)?3050/i, 130],
    // ── NVIDIA RTX 20 series ──────────────────────────────────────────────
    [/(?:rtx\s*)?2080\s*ti/i, 250],
    [/(?:rtx\s*)?2080\s*super/i, 250],
    [/(?:rtx\s*)?2080/i, 215],
    [/(?:rtx\s*)?2070\s*super/i, 215],
    [/(?:rtx\s*)?2070/i, 175],
    [/(?:rtx\s*)?2060\s*super/i, 175],
    [/(?:rtx\s*)?2060/i, 160],
    // ── NVIDIA GTX 16 series ──────────────────────────────────────────────
    [/(?:gtx\s*)?1660\s*ti/i, 120],
    [/(?:gtx\s*)?1660\s*super/i, 125],
    [/(?:gtx\s*)?1660/i, 120],
    [/(?:gtx\s*)?1650\s*super/i, 100],
    [/(?:gtx\s*)?1650/i, 75],
    // ── NVIDIA GTX 10 series ──────────────────────────────────────────────
    [/(?:gtx\s*)?1080\s*ti/i, 250],
    [/(?:gtx\s*)?1080/i, 180],
    [/(?:gtx\s*)?1070\s*ti/i, 180],
    [/(?:gtx\s*)?1070/i, 150],
    [/(?:gtx\s*)?1060/i, 120],
    [/(?:gtx\s*)?1050\s*ti/i, 75],
    [/(?:gtx\s*)?1050/i, 75],
    // ── NVIDIA Pro / Quadro series ────────────────────────────────────────
    [/(?:rtx\s*)?(?:pro\s*)?6000/i, 300],
    [/(?:rtx\s*)?a6000/i, 300],
    [/(?:rtx\s*)?a5000/i, 230],
    [/(?:rtx\s*)?a4000/i, 140],
    [/(?:rtx\s*)?a2000/i, 70],
    [/quadro\s*m4000/i, 120],
    // ── NVIDIA GT series ──────────────────────────────────────────────────
    [/(?:gt\s*|geforce\s+|n)?1030/i, 30],
    [/(?:gt\s*|geforce\s+|n)?730/i, 25],
    [/(?:gt\s*|geforce\s+|n)?710/i, 19],
    // ── AMD RX 9000 series ────────────────────────────────────────────────
    [/(?:rx\s*)?9070\s*xt/i, 304],
    [/(?:rx\s*)?9070/i, 220],
    [/(?:rx\s*)?9060\s*xt/i, 150],
    // ── AMD RX 7000 series ────────────────────────────────────────────────
    [/(?:rx\s*)?7900\s*xtx/i, 355],
    [/(?:rx\s*)?7900\s*gre/i, 260],
    [/(?:rx\s*)?7900\s*xt/i, 315],
    [/(?:rx\s*)?7800\s*xt/i, 263],
    [/(?:rx\s*)?7800/i, 250],
    [/(?:rx\s*)?7700\s*xt/i, 245],
    [/(?:rx\s*)?7700/i, 230],
    [/(?:rx\s*)?7600\s*xt/i, 190],
    [/(?:rx\s*)?7600/i, 165],
    // ── AMD RX 6000 series ────────────────────────────────────────────────
    [/(?:rx\s*)?6950\s*xt/i, 335],
    [/(?:rx\s*)?6900\s*xt/i, 300],
    [/(?:rx\s*)?6800\s*xt/i, 300],
    [/(?:rx\s*)?6800/i, 250],
    [/(?:rx\s*)?6750\s*xt/i, 250],
    [/(?:rx\s*)?6700\s*xt/i, 230],
    [/(?:rx\s*)?6700/i, 175],
    [/(?:rx\s*)?6650\s*xt/i, 180],
    [/(?:rx\s*)?6600\s*xt/i, 160],
    [/(?:rx\s*)?6600/i, 132],
    [/(?:rx\s*)?6500\s*xt/i, 107],
    [/(?:rx\s*)?6400/i, 53],
    // ── AMD RX 5000 series ────────────────────────────────────────────────
    [/(?:rx\s*)?5700\s*xt/i, 225],
    [/(?:rx\s*)?5700/i, 180],
    [/(?:rx\s*)?5600\s*xt/i, 150],
    [/(?:rx\s*)?5500\s*xt/i, 130],
    // ── AMD RX 500 series ─────────────────────────────────────────────────
    [/(?:rx\s*)?590/i, 225],
    [/(?:rx\s*)?580/i, 185],
    [/(?:rx\s*)?570/i, 150],
    [/(?:rx\s*)?560/i, 80],
    [/(?:rx\s*)?550/i, 50],
    // ── Intel Arc ─────────────────────────────────────────────────────────
    [/(?:arc\s*)?b580/i, 190],
    [/(?:arc\s*)?b570/i, 150],
    [/(?:arc\s*)?a770/i, 225],
    [/(?:arc\s*)?a750/i, 225],
    [/(?:arc\s*)?a580/i, 185],
    [/(?:arc\s*)?a380/i, 75],
  ];

  let tdp: number | null = null;
  for (const [pattern, watts] of GPU_TDP) {
    if (pattern.test(n)) { tdp = watts; break; }
  }

  let chipset: string | null = null;
  for (const [pattern, canonical] of CHIPSET_PATTERNS) {
    if (pattern.test(n)) {
      chipset = canonical;
      break;
    }
  }

  const rawSpecs = {
    length_mm: lengthMatch ? parseInt(lengthMatch[1]) : null,
    vram_gb: vramMatch ? parseInt(vramMatch[1]) : null,
    vram_type: vramTypeMatch ? vramTypeMatch[1].toUpperCase() : null,
    tdp,
    chipset,
  };

  // Sanity check for GPU length: must be between 140mm and 400mm
  if (rawSpecs.length_mm !== null && (rawSpecs.length_mm < 140 || rawSpecs.length_mm > 400)) {
    rawSpecs.length_mm = null;
  }

  return enrichGpuSpecs(n, rawSpecs);
};
