export interface CoolingSpecs {
  tdp: number;
  tags: string[];
  height_mm: number | null;
}

export const extractCoolingSpecs = (n: string, brand?: string): CoolingSpecs => {
  const brandPrefix = brand ? `${brand} ` : '';
  const lower = `${brandPrefix}${n}`.toLowerCase().replace(/\s+/g, ' ').trim();
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
    /\b(h)\d{2,4}[a-z]?\b/i,
    /\b(lt|ls|le|ld|lq|lm|nc|ml|mi|lc|th|gl|l)\d{3,4}[a-z]?\b/i,
    /\b(castle|spartacus|gamer\s*storm|rog\s*strix\s*lc|thicc|liquidboost|nautilus|mystique|pure.?loop|light.?loop|hanbo)\b/i,
    /\blc\s*(?:ii|iii|iv|v)?\s*(?:120|240|280|360|420)\b/i,
    /\bsg\d{1,2}[-–]?(120|240|280|360|420)\b/i,
    /\b(120|240|280|360|420)\s*(ml|w|b)\b/i,
    /\b(nano|aqua|arctic)\s+\w*\s*(120|240|280|360|420)\b/i,
    /\b(kraken|ryujin|ryuo|galahad|core.?liquid|master.?liquid|chione|hydro\w*|ml.?ultra\d*|symphony|waterforce|titan|ml[-_]?one\d*|h2o|aorus\d*|ek[-\s]?\d{3}|ekwb|lb-?\d{2,3}[a-z]*|hl-?\d{2,3}[a-z]*|p\d{3}|y\d{3}|nova\s*\d{2,3})\b/i
  ];

  const isCustomLoopPart = /\b(coolant|fitting|tubing|reservoir|distro.?plate|water.?block)\b/i.test(lower);

  const isAio = !isCustomLoopPart && (aioSignals.some(regex => regex.test(lower)) || 
                ((/\b(flow|frozen|glacier|ice|prism|halo|nexus|elite|ultra|nano|aqua|arctic|frost)\b/i.test(lower) && /\b(120|240|280|360|420)\b/.test(lower) && !lower.includes('arctic frost'))));

  if (isAio) {
    tags.push('aio');
    // Extract radiator size and tag it as e.g. "360mm"
    let size: string | null = null;
    if (/\b(420|170i)\b/.test(lower)) size = '420';
    else if (/\b(360|720|150i)\b/.test(lower)) size = '360';
    else if (/\b(280|115i)\b/.test(lower)) size = '280';
    else if (/\b(240|520|100i)\b/.test(lower)) size = '240';
    else if (/\b(140)\b/.test(lower)) size = '140';
    else if (/\b(120|60i)\b/.test(lower)) size = '120';
    
    if (size) {
      tags.push(`${size}mm`);
    }
  }

  if (isCustomLoopPart) {
    return { tdp: 0, tags: ['accessory'], height_mm: null };
  }

  // 2. Height and TDP Heuristics
  let height_mm: number | null = null;
  let tdp = 200; // default standard fallback

  if (isAio) {
    // AIO block height is a standard 52mm for RAM/case clearance checks
    height_mm = 52;
    
    // Explicit TDP match (e.g. "TDP 250W")
    const tdpMatch = lower.match(/\b(\d+)\s*w\b/i);
    if (tdpMatch) {
      tdp = parseInt(tdpMatch[1]);
    } else {
      // Models like LT720, H150i imply a 360mm radiator
      if (/\b(360|420|720|150i|170i)\b/.test(lower)) tdp = 320;
      else if (/\b(240|280|520|100i|115i)\b/.test(lower)) tdp = 250;
      else if (/\b(120|60i)\b/.test(lower)) tdp = 150;
      else tdp = 250; // default AIO TDP fallback
    }
  } else {
    // Air Cooler Height and TDP heuristics
    
    // Popular air coolers exact heights lookup
    const heightsDict: Record<string, number> = {
      'nh-d15': 165,
      'nh-u12s': 158,
      'nh-l9i': 37,
      'nh-l9a': 37,
      'pure rock 2': 155,
      'dark rock pro 4': 163,
      'dark rock 4': 159,
      'hyper 212': 159,
      'ak620': 160,
      'ak400': 155,
      'ag620': 160,
      'ag400': 150,
      'assassin iii': 165,
      'peerless assassin 120': 157,
      'phantom spirit 120': 154,
      'wraith prism': 92,
      'wraith stealth': 54,
      'wraith spire': 71,
      't120': 159,
      'h212': 159,
      'g200p': 39,
      'i70c': 60,
      'arctic frost': 65,
      'boreas e1-410': 154,
      'wraith ripper': 160,
    };

    for (const [key, h] of Object.entries(heightsDict)) {
      if (lower.includes(key)) {
        height_mm = h;
        break;
      }
    }

    const isLowProfile = /\b(low\s*profile|slim|l9i|l9a|g200p|c7|m9i|alpine|stock|heat\s*sink|intel\s*socket|amd\s*socket|wraith\s*stealth|alpine\s*17)\b/i.test(lower);
    const isDualTower = /\b(nh-d15|ak620|ag620|assassin|d15|peerless\s*assassin|phantom\s*spirit|dark\s*rock\s*pro|pure\s*rock\s*elite)\b/i.test(lower);
    const isBudgetSingleTower = /\b(90mm|92mm|80mm|m9a|i70c|xc|t2)\b/i.test(lower);

    if (height_mm === null) {
      if (isLowProfile) {
        if (lower.includes('l9i') || lower.includes('l9a')) height_mm = 37;
        else if (lower.includes('g200p')) height_mm = 39;
        else if (lower.includes('alpine 17')) height_mm = 68;
        else height_mm = 47;
      } else if (isBudgetSingleTower) {
        height_mm = 130;
      } else if (isDualTower) {
        height_mm = 160;
      } else {
        height_mm = 155; // Default standard single tower height
      }
    }

    // TDP heuristics
    const tdpMatch = lower.match(/\b(\d+)\s*w\b/i);
    if (tdpMatch) {
      tdp = parseInt(tdpMatch[1]);
    } else {
      if (lower.includes('wraith ripper')) {
        tdp = 250;
      } else if (lower.includes('boreas e1-410')) {
        tdp = 150;
      } else if (lower.includes('arctic frost')) {
        tdp = 95;
      } else if (lower.includes('nh-d15') || lower.includes('ak620') || lower.includes('ag620') || lower.includes('assassin') || lower.includes('peerless assassin') || lower.includes('phantom spirit')) {
        tdp = 250;
      } else if (lower.includes('ak400') || lower.includes('ag400') || lower.includes('hyper 212') || lower.includes('pure rock') || lower.includes('shadow rock')) {
        tdp = 180;
      } else if (lower.includes('wraith prism')) {
        tdp = 140;
      } else if (isLowProfile) {
        tdp = 65;
      } else if (isBudgetSingleTower) {
        tdp = 130;
      } else if (isDualTower) {
        tdp = 250;
      } else {
        tdp = 180; // Standard single tower TDP default
      }
    }
  }

  return { tdp, tags, height_mm };
};
