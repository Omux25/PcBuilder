import type { ComponentCategory } from './types.js';

/**
 * Decodes common HTML entities in scraped product names.
 * Retailers sometimes store names with HTML entities from their CMS.
 */
export function decodeHtml(text: string): string {
  return text
    .replace(/&#8211;/g, '–')   // en dash
    .replace(/&#8212;/g, '—')   // em dash
    .replace(/&#039;/g, "'")    // apostrophe
    .replace(/&rsquo;/g, "'")   // right single quote
    .replace(/&lsquo;/g, "'")   // left single quote
    .replace(/&amp;/g, '&')     // ampersand
    .replace(/&quot;/g, '"')    // double quote
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')    // any remaining numeric entities → space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Infers the component category from a scraped product name.
 * Returns null for accessories, peripherals, fans, cables, and bundles.
 */
export function inferCategory(name: string): ComponentCategory | null {
  const n = name.toLowerCase();

  // Explicit skip patterns — accessories and non-components
  if (n.match(/\b(souris|mouse|clavier|keyboard|casque|headset|écran|monitor|webcam|micro(?:phone)?)\b/)) return null;
  if (n.match(/\b(câble|cable|adaptateur|adapter|riser|extension|hub|dock)\b/)) return null;
  if (n.match(/\b(pack|bundle|kit\s*(pc|gaming)|pc\s*(gamer|gaming|complet))\b/)) return null;
  if (n.match(/\b(nvlink|sli bridge|bridge|upgrade kit|socket kit)\b/)) return null;
  if (n.match(/\b(so-dimm|sodimm)\b/)) return null; // laptop RAM — skip

  // CPU — check before motherboard to avoid "Ryzen 5 3400G + MSI A520M" bundles
  if (n.match(/\b(ryzen|core\s*i[3579]|core\s*ultra|threadripper|xeon|athlon|pentium|celeron)\b/)) return 'cpu';

  // GPU
  if (n.match(/\b(rtx|gtx|radeon|rx\s*\d{4}|arc\s*[ab]\d{3}|geforce|quadro|firepro)\b/)) return 'gpu';

  // Motherboard — explicit keywords first
  if (n.match(/\b(carte\s*m[eè]re|motherboard)\b/)) return 'motherboard';
  // chipset regex — includes M (mATX), D (DDR variant), F suffix
  if (n.match(/\b([abxhz]\d{3,4}[eimd]?)\b/) && !n.match(/\b(rtx|gtx|rx\s*\d{4})\b/)) return 'motherboard';

  // RAM — must NOT look like a motherboard
  if (n.match(/\b(ddr[45]|dimm)\b/) &&
    !n.match(/\b(carte\s*m[eè]re|motherboard)\b/) &&
    !n.match(/\b[abxhz]\d{3,4}[eimd]?\b/)) return 'ram';

  // Storage
  if (n.match(/\b(nvme|m\.?2|ssd|hdd|disque\s*(dur|ssd)|firecuda|barracuda|ironwolf)\b/)) return 'storage';
  if (n.match(/\b(sn\d{3}|bx\d{3}|mx\d{3}|p[235]\s*\d{3}|legend\s*\d{3})\b/)) return 'storage';

  // PSU
  // Require explicit wattage AND a PSU-specific keyword to avoid false positives
  if (n.match(/\b\d{3,4}\s*w\b/) &&
    n.match(/\b(alimentation|psu|gold|platinum|titanium|bronze|modular|80\s*plus|atx\s*3|semi.?mod|full.?mod)\b/) &&
    !n.match(/\b[abxhz]\d{3,4}[eimd]?\b/)) return 'psu';

  // Cooling — must be checked BEFORE fan (AIO coolers contain "fan" in some names)
  // Guard: "Air" in a case name (Corsair AIR series, Montech Air) must not match cooling
  if (n.match(/\b(aio|liquid\s*cooler|watercooler|watercooling|refroidissement\s*liquide)\b/)) return 'cooling';
  if (n.match(/\b(cooler|ventirad|refroidissement)\b/) &&
    !n.match(/\b(case|boitier|tower|air\s*\d{3,4})\b/)) return 'cooling';
  if (n.match(/\b(noctua|deepcool|arctic|thermalright|scythe|id.?cooling|be\s*quiet)\b/) &&
    n.match(/\b(nh|ak|lc|le|se|sl|bk|dk|sk|ld|lf|lp|lx|pure|shadow|dark|silent|freezer|liquid)\b/)) return 'cooling';
  // Brand-specific AIO model lines not caught by generic keywords
  if (n.match(/\b(nautilus|ryujin|ryuo|kraken|h\d{3}i|h\d{3}|elite\s*capellix|capellix|coreliquid|corefrozr)\b/)) return 'cooling';
  if (n.match(/\b(ets-t\d+|ets\s*t\d+|hyper\s*\d{3}|hyper\s*evo)\b/)) return 'cooling';
  if (n.match(/\b(enermax|mars\s*gaming)\b/) &&
    n.match(/\b(\d{3}\s*mm|\d{3}\s*argb|argb|frgb|lcd)\b/) &&
    !n.match(/\b(case|boitier|tower|psu|alimentation)\b/)) return 'cooling';

  // Case
  if (n.match(/\b(boitier|boîtier|case|tower|mid.?tower|full.?tower|mini.?tower)\b/)) return 'case';
  // Corsair AIR series, Montech Air series — these are cases, not coolers
  if (n.match(/\b(corsair\s*air|montech\s*air|fractal\s*pop\s*air|fractal\s*define\s*air)\b/)) return 'case';
  // Brand-specific case model lines not caught by generic keywords
  if (n.match(/\b(lancool|meshify|define\s*r|define\s*s|define\s*c|torrent|north|ridge|terra)\b/)) return 'case';
  if (n.match(/\b(carbide|obsidian|crystal|spec-\d|spec\s*omega|4000[dx]|5000[dx]|icue\s*\d{4})\b/)) return 'case';
  if (n.match(/\b(matrexx|deepcool\s*cc|cc\d{3,4}|ch\d{3,4}|cg\d{3,4})\b/)) return 'case';
  if (n.match(/\b(divider|view\s*\d{3}|level\s*20|s\d{3}|a\d{3}\s*argb)\b/) &&
    !n.match(/\b(cpu|gpu|ram|ssd|nvme|psu|alimentation)\b/)) return 'case';
  if (n.match(/\b(mc-[a-z0-9]+|mcart|mcorb|warship|stardust|elite\s*rainbow)\b/) &&
    !n.match(/\b(cpu|gpu|ram|ssd|nvme|psu|cooler|ventirad)\b/)) return 'case';
  if (n.match(/\b(h[5-9]\s*(flow|elite|elite\s*rgb)?|h\d{3}\s*(flow|elite)?)\b/) &&
    n.match(/\b(nzxt)\b/)) return 'case';

  // Thermal paste — checked before fan (some paste names contain "thermal" which could confuse)
  if (n.match(/\b(kryonaut|conductonaut|hydronaut|aeronaut|duronaut|carbonaut|kryosheet)\b/)) return 'thermal_paste';
  if (n.match(/\b(thermal\s*paste|pâte\s*thermique|pate\s*thermique|thermal\s*compound|thermal\s*grease)\b/)) return 'thermal_paste';
  if (n.match(/\b(mx-4|mx-6|mx-7)\b/) && !n.match(/\b(ddr|ram|memory)\b/)) return 'thermal_paste';
  if (n.match(/\b(thermal\s*grizzly|grizzly\s*kryonaut)\b/)) return 'thermal_paste';

  // Fan — standalone case/system fans (NOT CPU coolers, NOT AIO coolers)
  // Only match if not already matched as cooling above
  if (n.match(/\b(fan|ventilateur)\b/) && !n.match(/\b(cooler|refroidissement|aio|liquid|ventirad)\b/)) return 'fan';
  // Fan packs and specific fan model lines
  if (n.match(/\b(f120|f140|ll120|ql120|fd12|fd14|fk120|sickleflow|sicklefan)\b/)) return 'fan';
  if (n.match(/\b(light wings|pure wings|riing|toughfan)\b/)) return 'fan';
  // Standalone fan by size (only if no other category matched)
  if (n.match(/\b(120mm|140mm|200mm)\b/) && !n.match(/\b(aio|liquid|radiator|cooler)\b/)) return 'fan';

  return null;
}

export function extractBrand(name: string): string {
  const n = name.trim();
  // Known brands — check first word or first two words
  const BRANDS = [
    'AMD', 'Intel', 'NVIDIA', 'ASUS', 'MSI', 'Gigabyte', 'ASRock', 'EVGA',
    'Corsair', 'G.Skill', 'Kingston', 'Crucial', 'TeamGroup', 'Lexar', 'ADATA',
    'Samsung', 'WD', 'Seagate', 'Sabrent', 'Silicon Power',
    'Seasonic', 'be quiet!', 'Cooler Master', 'Thermaltake', 'Antec', 'DeepCool',
    'Fractal', 'NZXT', 'Lian Li', 'Phanteks', 'Aerocool', 'Silverstone',
    'Noctua', 'Arctic', 'Thermalright', 'Scythe', 'ID-Cooling', 'APNX',
    'Arktek', 'Inno3D', 'Palit', 'Zotac', 'Sapphire', 'PowerColor', 'XFX',
    'PNY', 'Gainward', 'Colorful', 'Galax', 'KFA2',
    'Acer', 'HP', 'Toshiba', 'Patriot', 'Klevv', 'Geil', 'Mushkin',
    'FSP', 'Super Flower', 'XPG', 'Cougar', 'Chieftec', 'LC Power',
    '1stPlayer', 'Kolink', 'Sharkoon', 'BitFenix',
    'Mars Gaming', 'M.RED', 'Enermax', 'Xigmatek', 'Montech', 'Cougar',
  ];

  for (const brand of BRANDS) {
    if (n.toLowerCase().startsWith(brand.toLowerCase())) return brand;
  }

  // Fall back to first word
  return n.split(/\s+/)[0];
}

/**
 * Strips packaging/variant suffixes from a scraped product name to get
 * a clean catalog name.
 */
export function cleanName(rawName: string, brand: string): string {
  let name = decodeHtml(rawName)
    .replace(new RegExp(`^${brand}\\s*`, 'i'), '')  // strip brand prefix
    .replace(/\s*(BOX|Tray|MPK|OEM|Bulk|no\s*fan|wraith\s*\w+|edition)\s*/gi, ' ')
    .replace(/\s*\(\d+\.?\d*\s*GHz\s*\/\s*\d+\.?\d*\s*GHz\)\s*/gi, '') // strip clock speeds
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ── Spec extractors ───────────────────────────────────────────────────────────

export function extractCpuSpecs(name: string): { socket: string; tdp: number } | null {
  const n = name.toLowerCase();

  // Extract model number to determine generation
  const modelMatch = n.match(/\b(\d{4,5}[a-z0-9]{0,4})\b/);
  const modelNum = modelMatch ? parseInt(modelMatch[1]) : 0;

  let socket = '';

  // AMD Ryzen — determine socket from model number
  if (n.match(/\bryzen/)) {
    if (modelNum >= 7000 || n.match(/\b9[0-9]{3}x?\b/)) socket = 'AM5';
    else socket = 'AM4'; // Ryzen 1000–5000 series
  }
  // AMD Athlon / APU (G-series)
  else if (n.match(/\b(athlon|a[468]\d{3}g?)\b/)) socket = 'AM4';
  // Intel Core Ultra (Arrow Lake / Meteor Lake)
  else if (n.match(/\bcore\s*ultra/)) socket = 'LGA1851';
  // Intel Core iX — determine socket from generation
  else if (n.match(/\bcore\s*i[3579]/)) {
    if (modelNum >= 14000) socket = 'LGA1700';       // 14th gen
    else if (modelNum >= 12000) socket = 'LGA1700';  // 12th/13th gen
    else if (modelNum >= 10000) socket = 'LGA1200';  // 10th/11th gen
    else if (modelNum >= 8000) socket = 'LGA1151';  // 8th/9th gen
    else if (modelNum >= 6000) socket = 'LGA1151';  // 6th/7th gen
    else socket = 'LGA1700'; // fallback for unknown
  }
  // Intel Pentium / Celeron
  else if (n.match(/\b(pentium|celeron)\b/)) socket = 'LGA1200';
  // Intel Xeon
  else if (n.match(/\bxeon\b/)) socket = 'LGA1700';
  // AMD Threadripper
  else if (n.match(/\bthreadripper/)) socket = 'TRX40';

  if (!socket) return null;

  // Estimate TDP from model tier
  let tdp = 65;
  if (n.match(/\b(i9|ryzen\s*9|threadripper)\b/)) tdp = 125;
  else if (n.match(/\b(i7|ryzen\s*7)\b/)) tdp = 105;
  else if (n.match(/\b(i5|ryzen\s*5)\b/)) tdp = 65;
  else if (n.match(/\b(i3|ryzen\s*3)\b/)) tdp = 58;
  // Unlocked Intel multiplier = 125W
  if (n.match(/\b\d{4,5}k[fs]?\b/) && n.match(/intel|core/)) tdp = 125;

  return { socket, tdp };
}

export function extractGpuSpecs(name: string): { length_mm: number; tdp: number; vram_gb: number } {
  const n = name.toLowerCase();

  // Extract VRAM from name
  let vram_gb = 8;
  const vramMatch = n.match(/\b(\d+)\s*g[bo]\b/);
  if (vramMatch) vram_gb = parseInt(vramMatch[1]);

  // TDP lookup by model — ordered most specific first
  let tdp = 150;
  // RTX 50 series
  if (n.match(/\brtx\s*5090\b/)) tdp = 575;
  else if (n.match(/\brtx\s*5080\b/)) tdp = 360;
  else if (n.match(/\brtx\s*5070\s*ti\b/)) tdp = 300;
  else if (n.match(/\brtx\s*5070\b/)) tdp = 250;
  else if (n.match(/\brtx\s*5060\s*ti\b/)) tdp = 180;
  else if (n.match(/\brtx\s*5060\b/)) tdp = 150;
  else if (n.match(/\brtx\s*5050\b/)) tdp = 120;
  // RTX 40 series
  else if (n.match(/\brtx\s*4090\b/)) tdp = 450;
  else if (n.match(/\brtx\s*4080\s*super\b/)) tdp = 320;
  else if (n.match(/\brtx\s*4080\b/)) tdp = 320;
  else if (n.match(/\brtx\s*4070\s*ti\s*super\b/)) tdp = 285;
  else if (n.match(/\brtx\s*4070\s*ti\b/)) tdp = 285;
  else if (n.match(/\brtx\s*4070\s*super\b/)) tdp = 220;
  else if (n.match(/\brtx\s*4070\b/)) tdp = 200;
  else if (n.match(/\brtx\s*4060\s*ti\b/)) tdp = 165;
  else if (n.match(/\brtx\s*4060\b/)) tdp = 115;
  // RTX 30 series
  else if (n.match(/\brtx\s*3090\s*ti\b/)) tdp = 450;
  else if (n.match(/\brtx\s*3090\b/)) tdp = 350;
  else if (n.match(/\brtx\s*3080\s*ti\b/)) tdp = 350;
  else if (n.match(/\brtx\s*3080\b/)) tdp = 320;
  else if (n.match(/\brtx\s*3070\s*ti\b/)) tdp = 290;
  else if (n.match(/\brtx\s*3070\b/)) tdp = 220;
  else if (n.match(/\brtx\s*3060\s*ti\b/)) tdp = 200;
  else if (n.match(/\brtx\s*3060\b/)) tdp = 170;
  else if (n.match(/\brtx\s*3050\b/)) tdp = 130;
  // RTX 20 series
  else if (n.match(/\brtx\s*2080\s*ti\b/)) tdp = 250;
  else if (n.match(/\brtx\s*2080\s*super\b/)) tdp = 250;
  else if (n.match(/\brtx\s*2080\b/)) tdp = 215;
  else if (n.match(/\brtx\s*2070\s*super\b/)) tdp = 215;
  else if (n.match(/\brtx\s*2070\b/)) tdp = 175;
  else if (n.match(/\brtx\s*2060\s*super\b/)) tdp = 175;
  else if (n.match(/\brtx\s*2060\b/)) tdp = 160;
  // GTX 16 series
  else if (n.match(/\bgtx\s*1660\s*ti\b/)) tdp = 120;
  else if (n.match(/\bgtx\s*1660\s*super\b/)) tdp = 125;
  else if (n.match(/\bgtx\s*1660\b/)) tdp = 120;
  else if (n.match(/\bgtx\s*1650\s*super\b/)) tdp = 100;
  else if (n.match(/\bgtx\s*1650\b/)) tdp = 75;
  // GTX 10 series
  else if (n.match(/\bgtx\s*1080\s*ti\b/)) tdp = 250;
  else if (n.match(/\bgtx\s*1080\b/)) tdp = 180;
  else if (n.match(/\bgtx\s*1070\s*ti\b/)) tdp = 180;
  else if (n.match(/\bgtx\s*1070\b/)) tdp = 150;
  else if (n.match(/\bgtx\s*1060\b/)) tdp = 120;
  else if (n.match(/\bgtx\s*1050\s*ti\b/)) tdp = 75;
  else if (n.match(/\bgtx\s*1050\b/)) tdp = 75;
  else if (n.match(/\bgt\s*1030\b/)) tdp = 30;
  else if (n.match(/\bgt\s*730\b/)) tdp = 25;
  // AMD RX 9000 series
  else if (n.match(/\brx\s*9070\s*xt\b/)) tdp = 304;
  else if (n.match(/\brx\s*9070\b/)) tdp = 220;
  else if (n.match(/\brx\s*9060\s*xt\b/)) tdp = 150;
  // AMD RX 7000 series
  else if (n.match(/\brx\s*7900\s*xtx\b/)) tdp = 355;
  else if (n.match(/\brx\s*7900\s*xt\b/)) tdp = 315;
  else if (n.match(/\brx\s*7900\s*gre\b/)) tdp = 260;
  else if (n.match(/\brx\s*7800\s*xt\b/)) tdp = 263;
  else if (n.match(/\brx\s*7700\s*xt\b/)) tdp = 245;
  else if (n.match(/\brx\s*7600\s*xt\b/)) tdp = 190;
  else if (n.match(/\brx\s*7600\b/)) tdp = 165;
  // AMD RX 6000 series
  else if (n.match(/\brx\s*6950\s*xt\b/)) tdp = 335;
  else if (n.match(/\brx\s*6900\s*xt\b/)) tdp = 300;
  else if (n.match(/\brx\s*6800\s*xt\b/)) tdp = 300;
  else if (n.match(/\brx\s*6800\b/)) tdp = 250;
  else if (n.match(/\brx\s*6750\s*xt\b/)) tdp = 250;
  else if (n.match(/\brx\s*6700\s*xt\b/)) tdp = 230;
  else if (n.match(/\brx\s*6700\b/)) tdp = 175;
  else if (n.match(/\brx\s*6650\s*xt\b/)) tdp = 180;
  else if (n.match(/\brx\s*6600\s*xt\b/)) tdp = 160;
  else if (n.match(/\brx\s*6600\b/)) tdp = 132;
  else if (n.match(/\brx\s*6500\s*xt\b/)) tdp = 107;
  else if (n.match(/\brx\s*6400\b/)) tdp = 53;
  // AMD RX 5000 series
  else if (n.match(/\brx\s*5700\s*xt\b/)) tdp = 225;
  else if (n.match(/\brx\s*5700\b/)) tdp = 180;
  else if (n.match(/\brx\s*5600\s*xt\b/)) tdp = 150;
  else if (n.match(/\brx\s*5500\s*xt\b/)) tdp = 130;
  // Intel Arc
  else if (n.match(/\barc\s*b580\b/)) tdp = 190;
  else if (n.match(/\barc\s*b570\b/)) tdp = 150;
  else if (n.match(/\barc\s*a770\b/)) tdp = 225;
  else if (n.match(/\barc\s*a750\b/)) tdp = 225;
  else if (n.match(/\barc\s*a580\b/)) tdp = 185;

  // Estimate length from TDP tier
  let length_mm = 240;
  if (tdp >= 400) length_mm = 360;
  else if (tdp >= 300) length_mm = 336;
  else if (tdp >= 200) length_mm = 285;
  else if (tdp >= 130) length_mm = 240;
  else length_mm = 200;

  return { length_mm, tdp, vram_gb };
}

export function extractRamSpecs(name: string): { ram_type: 'DDR4' | 'DDR5'; frequency_mhz: number; capacity_gb: number } | null {
  const n = name.toLowerCase();

  const typeMatch = n.match(/\b(ddr[45])\b/);
  if (!typeMatch) return null;
  const ram_type = typeMatch[1].toUpperCase() as 'DDR4' | 'DDR5';

  // Capacity — handle kit notation
  let capacity_gb = 16;
  const kitMatch = n.match(/(\d+)\s*x\s*(\d+)\s*gb/);
  if (kitMatch) capacity_gb = parseInt(kitMatch[1]) * parseInt(kitMatch[2]);
  else {
    const capMatch = n.match(/\b(\d+)\s*gb\b/);
    if (capMatch) capacity_gb = parseInt(capMatch[1]);
  }

  // Speed
  let frequency_mhz = ram_type === 'DDR5' ? 4800 : 3200;
  const speedMatch = n.match(/\b(\d{4,5})\s*(mhz)?\b/);
  if (speedMatch) {
    const spd = parseInt(speedMatch[1]);
    if (spd >= 2133 && spd <= 12000) frequency_mhz = spd;
  }

  return { ram_type, frequency_mhz, capacity_gb };
}

export function extractStorageSpecs(name: string): { capacity_gb: number; interface_type: string } | null {
  const n = name.toLowerCase();

  // Capacity
  let capacity_gb = 0;
  const tbMatch = n.match(/\b(\d+)\s*tb\b/);
  const gbMatch = n.match(/\b(\d{3,4})\s*gb\b/);
  if (tbMatch) capacity_gb = parseInt(tbMatch[1]) * 1000;
  else if (gbMatch) capacity_gb = parseInt(gbMatch[1]);
  if (capacity_gb === 0) return null;

  // Interface
  let interface_type = 'M.2 PCIe 4.0 x4';
  if (n.match(/\bgen\s*5\b/) || n.match(/\bpcie\s*5\b/)) interface_type = 'M.2 PCIe 5.0 x4';
  else if (n.match(/\bgen\s*3\b/) || n.match(/\bpcie\s*3\b/)) interface_type = 'M.2 PCIe 3.0 x4';
  else if (n.match(/\bsata\b/) && !n.match(/\bnvme\b/)) interface_type = 'SATA 6Gb/s';

  return { capacity_gb, interface_type };
}

export function extractMotherboardSpecs(name: string): {
  socket: string; chipset: string;
  supported_ram_types: string[]; max_ram_frequency: number;
} | null {
  const n = name.toLowerCase();

  const chipsetMatch = n.match(/\b([abxhz]\d{3,4}[eimd]?)\b/);
  if (!chipsetMatch) return null;
  const chipset = chipsetMatch[1].toUpperCase();

  // Determine socket and RAM type from chipset
  const AM5_CHIPSETS = ['X870E', 'X870', 'X670E', 'X670', 'B650E', 'B650', 'A620'];
  const AM4_CHIPSETS = ['X570', 'B550', 'X470', 'B450', 'A520', 'A320', 'B350', 'X370',
    // mATX variants
    'B550M', 'B450M', 'A520M', 'A320M', 'X570M'];
  // LGA1851: Intel Arrow Lake (Core Ultra 200 series) — B860/B850/B840 are Intel, not AMD
  const LGA1851_CHIPSETS = ['Z890', 'B860', 'B850', 'B840', 'H870'];
  const LGA1700_CHIPSETS = ['Z790', 'Z690', 'B760', 'B660', 'H770', 'H670', 'H610',
    // mATX variants
    'B760M', 'B660M', 'H610M', 'H670M', 'Z790M', 'Z690M'];
  const LGA1200_CHIPSETS = ['Z590', 'Z490', 'B560', 'B460', 'H570', 'H510', 'H470', 'H410',
    // mATX variants
    'B560M', 'B460M', 'H510M', 'H470M', 'H410M', 'Z590M', 'Z490M'];
  const LGA1151_CHIPSETS = ['Z390', 'Z370', 'B365', 'B360', 'H370', 'H310',
    // mATX variants
    'B365M', 'B360M', 'H370M', 'H310M', 'Z390M'];

  let socket = '';
  let supported_ram_types: string[] = ['DDR4'];
  let max_ram_frequency = 3200;

  if (AM5_CHIPSETS.includes(chipset)) {
    socket = 'AM5'; supported_ram_types = ['DDR5']; max_ram_frequency = 6400;
  } else if (AM4_CHIPSETS.includes(chipset)) {
    socket = 'AM4'; supported_ram_types = ['DDR4']; max_ram_frequency = 4400;
  } else if (LGA1851_CHIPSETS.includes(chipset)) {
    socket = 'LGA1851'; supported_ram_types = ['DDR5']; max_ram_frequency = 9200;
  } else if (LGA1700_CHIPSETS.includes(chipset)) {
    socket = 'LGA1700';
    // Z690/B660 support both DDR4 and DDR5 depending on variant
    supported_ram_types = n.includes('ddr4') ? ['DDR4'] : n.includes('ddr5') ? ['DDR5'] : ['DDR4', 'DDR5'];
    max_ram_frequency = 6400;
  } else if (LGA1200_CHIPSETS.includes(chipset)) {
    socket = 'LGA1200'; supported_ram_types = ['DDR4']; max_ram_frequency = 4800;
  } else if (LGA1151_CHIPSETS.includes(chipset)) {
    socket = 'LGA1151'; supported_ram_types = ['DDR4']; max_ram_frequency = 4266;
  } else {
    return null; // Unknown chipset
  }

  return { socket, chipset, supported_ram_types, max_ram_frequency };
}

export function extractPsuSpecs(name: string): { wattage: number; efficiency: string; modular: string } | null {
  const n = name.toLowerCase();
  const wattMatch = n.match(/\b(\d{3,4})\s*w\b/);
  if (!wattMatch) return null;
  const wattage = parseInt(wattMatch[1]);
  if (wattage < 300 || wattage > 2000) return null;
  let efficiency = '80+ Bronze';
  if (n.includes('titanium')) efficiency = '80+ Titanium';
  else if (n.includes('platinum')) efficiency = '80+ Platinum';
  else if (n.includes('gold')) efficiency = '80+ Gold';
  else if (n.includes('silver')) efficiency = '80+ Silver';
  else if (n.includes('bronze')) efficiency = '80+ Bronze';
  else if (n.match(/80\s*plus/)) efficiency = '80+';
  let modular = 'Non-modular';
  if (n.match(/full.?mod|fully.?mod/)) modular = 'Fully modular';
  else if (n.match(/semi.?mod/)) modular = 'Semi-modular';
  else if (n.includes('modular')) modular = 'Fully modular';
  return { wattage, efficiency, modular };
}

export function extractCoolingSpecs(name: string): { tdp: number; cooling_type: string; size_mm: number | null } | null {
  const n = name.toLowerCase();
  const aioMatch = n.match(/\b(120|140|240|280|360|420)\s*mm\b/);
  if (aioMatch || n.match(/\b(aio|liquid|watercooling)\b/)) {
    const size_mm = aioMatch ? parseInt(aioMatch[1]) : null;
    let tdp = 250;
    if (size_mm === 420 || size_mm === 360) tdp = 350;
    else if (size_mm === 280 || size_mm === 240) tdp = 280;
    else if (size_mm === 140 || size_mm === 120) tdp = 180;
    return { tdp, cooling_type: 'AIO', size_mm };
  }
  if (n.match(/\b(cooler|ventirad|refroidissement|aircooler)\b/) ||
    n.match(/\b(noctua|deepcool|arctic|thermalright|scythe|be\s*quiet)\b/)) {
    let tdp = 150;
    if (n.match(/\b(nh-d15|nh-d14|dark rock pro|assassin|fuma)\b/)) tdp = 250;
    else if (n.match(/\b(nh-u12|nh-u14|ak620|ak400|shadow rock)\b/)) tdp = 200;
    return { tdp, cooling_type: 'Air', size_mm: null };
  }
  return null;
}

export function extractCaseSpecs(name: string): { form_factor: string; max_gpu_length_mm: number } {
  const n = name.toLowerCase();
  let form_factor = 'ATX Mid Tower';
  if (n.match(/\b(mini.?itx|itx)\b/)) form_factor = 'Mini-ITX';
  else if (n.match(/\b(micro.?atx|matx|m-atx)\b/)) form_factor = 'mATX Mid Tower';
  else if (n.match(/\b(full.?tower|xl.?atx|e-atx)\b/)) form_factor = 'ATX Full Tower';
  let max_gpu_length_mm = 380;
  if (form_factor === 'Mini-ITX') max_gpu_length_mm = 300;
  else if (form_factor === 'mATX Mid Tower') max_gpu_length_mm = 350;
  else if (form_factor === 'ATX Full Tower') max_gpu_length_mm = 450;
  return { form_factor, max_gpu_length_mm };
}

/**
 * Extracts fan-specific specs from a scraped product name.
 * Used by catalogBuilder to auto-create fan components.
 * Requirements: 15.1, 15.3, 15.4
 */
export function extractFanSpecs(name: string): { size_mm: number; rgb: boolean; pack_size: number } {
  // Size: 80mm, 92mm, 120mm, 140mm, 200mm — default 120
  const sizeMatch = name.match(/\b(80|92|120|140|200)\s*mm\b/i);
  const size_mm = sizeMatch ? parseInt(sizeMatch[1]) : 120;

  // RGB/ARGB lighting
  const rgb = /\b(rgb|argb)\b/i.test(name);

  // Pack size: triple/3-pack/3x → 3, dual/twin/2-pack/2x → 2, else 1
  let pack_size = 1;
  if (/\b(triple|3[\s-]?pack|3x)\b/i.test(name)) pack_size = 3;
  else if (/\b(dual|twin|2[\s-]?pack|2x)\b/i.test(name)) pack_size = 2;

  return { size_mm, rgb, pack_size };
}

/**
 * Extracts thermal paste-specific specs from a scraped product name.
 * Used by catalogBuilder to auto-create thermal_paste components.
 * Requirements: 16.1, 16.3, 16.4
 */
export function extractThermalPasteSpecs(name: string): {
  weight_grams: number | null;
  paste_type: 'paste' | 'liquid_metal' | 'pad';
} {
  // Weight: "4g", "8g", "1 gramme", "4 grammes", "3.9 grammes"
  const weightMatch = name.match(/\b(\d+(?:\.\d+)?)\s*(?:grammes?|g)\b/i);
  const weight_grams = weightMatch ? parseFloat(weightMatch[1]) : null;

  // Paste type
  let paste_type: 'paste' | 'liquid_metal' | 'pad' = 'paste';
  if (/\b(conductonaut|liquid\s*metal)\b/i.test(name)) paste_type = 'liquid_metal';
  else if (/\b(carbonaut|kryosheet|pad)\b/i.test(name)) paste_type = 'pad';

  return { weight_grams, paste_type };
}
