export interface CoolingSpecs {
  tdp: number;
  tags: string[];
}

export const extractCoolingSpecs = (n: string): CoolingSpecs => {
  const lower = n.toLowerCase();
  const tags: string[] = [];
  
  // 1. Identify AIO vs Air
  // Strong AIO signals: radiator sizes, explicit liquid/water cooling keywords, and specific series
  const aioSignals = [
    /\baio\b/i,
    /\bliquid\b/i,
    /\bwatercooler\b/i,
    /\bwatercooling\b/i,
    /\bwater\s*cooler\b/i,
    /\bwater\s*cooling\b/i,
    /\brefroidissement\s*liquide\b/i,
    /\b(120|140|240|280|360|420)\s*mm\b/i,
    /\b(kraken|ryujin|ryuo|galahad|core.?liquid|chione|hydro.?shift|ml.?ultra|symphony|waterforce|lb-?\d{2,3}[a-z]*|hl-?\d{2,3}[a-z]*|p\d{3}|y\d{3}|nova\s*\d{2,3}|arctic\s*frost|frost\s*frgb)\b/i
  ];

  const isAio = aioSignals.some(regex => regex.test(lower));
  if (isAio) {
    tags.push('aio');
  }

  // 2. Extract radiator size
  const radMatch = n.match(/\b(120|140|240|280|360|420)\s*mm\b/i);
  if (radMatch) {
    tags.push(`${radMatch[1]}mm`);
  }

  // 3. TDP extraction
  let tdp = 200; // default for mid-range air/aio
  
  // Explicit TDP match (e.g. "TDP 250W")
  const tdpMatch = n.match(/\b(\d+)\s*W\b/i);
  if (tdpMatch) {
    tdp = parseInt(tdpMatch[1]);
  } else if (isAio) {
    // Heuristic based on radiator size
    if (lower.includes('420')) tdp = 350;
    else if (lower.includes('360')) tdp = 300;
    else if (lower.includes('280')) tdp = 280;
    else if (lower.includes('240')) tdp = 250;
    else if (lower.includes('120') || lower.includes('140')) tdp = 180;
  } else {
    // Air cooler heuristics
    if (lower.includes('hyper 212') || lower.includes('ak400') || lower.includes('ag400')) tdp = 180;
    else if (lower.includes('ak620') || lower.includes('assassin') || lower.includes('nh-d15')) tdp = 260;
  }

  return { tdp, tags };
};
