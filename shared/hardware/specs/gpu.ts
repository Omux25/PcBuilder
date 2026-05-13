export const extractGpuSpecs = (n: string) => {
  const lengthMatch = n.match(/\b(\d{3})\s*mm\b/i);
  const vramMatch = n.match(/\b(\d+)\s*(?:gb|go)\b/i);

  // TDP lookup by GPU chipset — official NVIDIA/AMD TDP values (board power)
  // Ordered longest-match first to avoid "4070" matching "4070 Ti Super"
  const GPU_TDP: [RegExp, number][] = [
    // ── NVIDIA RTX 50 series ──────────────────────────────────────────────
    [/rtx\s*5090/i, 575],
    [/rtx\s*5080/i, 360],
    [/rtx\s*5070\s*ti/i, 300],
    [/rtx\s*5070/i, 250],
    [/rtx\s*5060\s*ti/i, 180],
    [/rtx\s*5060/i, 150],
    [/rtx\s*5050/i, 130],
    // ── NVIDIA RTX 40 series ──────────────────────────────────────────────
    [/rtx\s*4090/i, 450],
    [/rtx\s*4080\s*super/i, 320],
    [/rtx\s*4080/i, 320],
    [/rtx\s*4070\s*ti\s*super/i, 285],
    [/rtx\s*4070\s*ti/i, 285],
    [/rtx\s*4070\s*super/i, 220],
    [/rtx\s*4070/i, 200],
    [/rtx\s*4060\s*ti/i, 165],
    [/rtx\s*4060/i, 115],
    // ── NVIDIA RTX 30 series ──────────────────────────────────────────────
    [/rtx\s*3090\s*ti/i, 450],
    [/rtx\s*3090/i, 350],
    [/rtx\s*3080\s*ti/i, 350],
    [/rtx\s*3080/i, 320],
    [/rtx\s*3070\s*ti/i, 290],
    [/rtx\s*3070/i, 220],
    [/rtx\s*3060\s*ti/i, 200],
    [/rtx\s*3060/i, 170],
    [/rtx\s*3050/i, 130],
    // ── NVIDIA RTX 20 series ──────────────────────────────────────────────
    [/rtx\s*2080\s*ti/i, 250],
    [/rtx\s*2080\s*super/i, 250],
    [/rtx\s*2080/i, 215],
    [/rtx\s*2070\s*super/i, 215],
    [/rtx\s*2070/i, 175],
    [/rtx\s*2060\s*super/i, 175],
    [/rtx\s*2060/i, 160],
    // ── NVIDIA GTX 16 series ──────────────────────────────────────────────
    [/gtx\s*1660\s*ti/i, 120],
    [/gtx\s*1660\s*super/i, 125],
    [/gtx\s*1660/i, 120],
    [/gtx\s*1650\s*super/i, 100],
    [/gtx\s*1650/i, 75],
    // ── NVIDIA GTX 10 series ──────────────────────────────────────────────
    [/gtx\s*1080\s*ti/i, 250],
    [/gtx\s*1080/i, 180],
    [/gtx\s*1070\s*ti/i, 180],
    [/gtx\s*1070/i, 150],
    [/gtx\s*1060/i, 120],
    [/gtx\s*1050\s*ti/i, 75],
    [/gtx\s*1050/i, 75],
    // ── NVIDIA GT series ──────────────────────────────────────────────────
    [/gt\s*1030/i, 30],
    [/gt\s*730/i, 25],
    [/gt\s*710/i, 19],
    // ── AMD RX 9000 series ────────────────────────────────────────────────
    [/rx\s*9070\s*xt/i, 304],
    [/rx\s*9070/i, 220],
    [/rx\s*9060\s*xt/i, 150],
    // ── AMD RX 7000 series ────────────────────────────────────────────────
    [/rx\s*7900\s*xtx/i, 355],
    [/rx\s*7900\s*gre/i, 260],
    [/rx\s*7900\s*xt/i, 315],
    [/rx\s*7800\s*xt/i, 263],
    [/rx\s*7700\s*xt/i, 245],
    [/rx\s*7600\s*xt/i, 165],
    [/rx\s*7600/i, 165],
    // ── AMD RX 6000 series ────────────────────────────────────────────────
    [/rx\s*6950\s*xt/i, 335],
    [/rx\s*6900\s*xt/i, 300],
    [/rx\s*6800\s*xt/i, 300],
    [/rx\s*6800/i, 250],
    [/rx\s*6750\s*xt/i, 250],
    [/rx\s*6700\s*xt/i, 230],
    [/rx\s*6700/i, 175],
    [/rx\s*6650\s*xt/i, 180],
    [/rx\s*6600\s*xt/i, 160],
    [/rx\s*6600/i, 132],
    [/rx\s*6500\s*xt/i, 107],
    [/rx\s*6400/i, 53],
    // ── AMD RX 5000 series ────────────────────────────────────────────────
    [/rx\s*5700\s*xt/i, 225],
    [/rx\s*5700/i, 180],
    [/rx\s*5600\s*xt/i, 150],
    [/rx\s*5500\s*xt/i, 130],
    // ── AMD RX 500 series ─────────────────────────────────────────────────
    [/rx\s*590/i, 225],
    [/rx\s*580/i, 185],
    [/rx\s*570/i, 150],
    [/rx\s*560/i, 80],
    [/rx\s*550/i, 50],
    // ── Intel Arc ─────────────────────────────────────────────────────────
    [/arc\s*b580/i, 190],
    [/arc\s*b570/i, 150],
    [/arc\s*a770/i, 225],
    [/arc\s*a750/i, 225],
    [/arc\s*a580/i, 185],
    [/arc\s*a380/i, 75],
  ];

  let tdp: number | null = null;
  for (const [pattern, watts] of GPU_TDP) {
    if (pattern.test(n)) { tdp = watts; break; }
  }

  return {
    length_mm: lengthMatch ? parseInt(lengthMatch[1]) : 300,
    vram_gb: vramMatch ? parseInt(vramMatch[1]) : null,
    tdp,
  };
};
