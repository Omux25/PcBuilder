/**
 * catalogBuilder.ts — Auto-creates catalog entries from scraped product names.
 *
 * Called after autoMap() for listings that couldn't be matched to any existing
 * catalog entry. For categories where specs can be reliably extracted from the
 * product name (CPU, GPU, RAM, storage, motherboard), it creates a new catalog
 * entry and immediately maps the listing to it.
 *
 * For categories where specs cannot be reliably extracted (case, cooling, PSU),
 * the listing stays in unmatched_listings for admin review.
 *
 * This closes the loop: scrapers find new products → catalogBuilder adds them
 * to the catalog → autoMapper links them → next scrape prices them correctly.
 *
 * Deduplication: before inserting, checks if a component with the same DNA
 * tokens already exists (catches name variations like "BOX" vs "Tray").
 */

import { sql as bunSql } from 'bun';
import { componentSlug, generateUniqueSlug } from '../src/utils/slugify.js';
import { extractDna, scoreDnaMatch, type CatalogComponent } from '../src/utils/componentMatcher.js';
import { logger } from './utils/logger.js';

// ── Dependency injection ──────────────────────────────────────────────────────

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
let _sql: SqlFn = bunSql as unknown as SqlFn;

export function setSql(mockSql: SqlFn): void { _sql = mockSql; }
export function resetSql(): void { _sql = bunSql as unknown as SqlFn; }

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BuildResult {
  created: number;
  skipped: number;
}

// ── Category classifier ───────────────────────────────────────────────────────

/**
 * Infers the component category from a scraped product name.
 * Returns null for accessories, peripherals, fans, cables, and bundles.
 */
function inferCategory(name: string): string | null {
  const n = name.toLowerCase();

  // Explicit skip patterns — accessories and non-components
  if (n.match(/\b(souris|mouse|clavier|keyboard|casque|headset|écran|monitor|webcam|micro(?:phone)?)\b/)) return null;
  if (n.match(/\b(câble|cable|adaptateur|adapter|riser|extension|hub|dock)\b/)) return null;
  if (n.match(/\b(pâte|paste|thermal grease|graisse)\b/)) return null;
  if (n.match(/\b(fan|ventilateur)\b/) && !n.match(/\b(cooler|refroidissement|aio|liquid)\b/)) return null;
  if (n.match(/\b(pack|bundle|kit\s*(pc|gaming)|pc\s*(gamer|gaming|complet))\b/)) return null;
  if (n.match(/\b(nvlink|sli bridge|bridge)\b/)) return null;

  // CPU
  if (n.match(/\b(ryzen|core\s*i[3579]|core\s*ultra|threadripper|xeon|athlon|pentium|celeron)\b/)) return 'cpu';

  // GPU
  if (n.match(/\b(rtx|gtx|radeon|rx\s*\d{4}|arc\s*[ab]\d{3}|geforce|quadro|firepro)\b/)) return 'gpu';

  // Motherboard — chipset patterns
  if (n.match(/\b(carte\s*m[eè]re|motherboard)\b/)) return 'motherboard';
  if (n.match(/\b([abxhz]\d{3,4}[ei]?)\b/) && !n.match(/\b(rtx|gtx|rx\s*\d{4})\b/)) return 'motherboard';

  // RAM — must NOT look like a motherboard (chipset pattern takes priority)
  if (n.match(/\b(ddr[45]|dimm|sodimm)\b/) &&
      !n.match(/\b(carte\s*m[eè]re|motherboard)\b/) &&
      !n.match(/\b[abxhz]\d{3,4}[ei]?\b/)) return 'ram';

  // Storage
  if (n.match(/\b(nvme|m\.?2|ssd|hdd|disque\s*dur|firecuda|barracuda|ironwolf)\b/)) return 'storage';
  if (n.match(/\b(sn\d{3}|bx\d{3}|mx\d{3}|p[235]\s*\d{3}|legend\s*\d{3})\b/)) return 'storage';

  // PSU — only if wattage is explicit
  if (n.match(/\b\d{3,4}\s*w\b/) && n.match(/\b(alimentation|psu|gold|platinum|titanium|bronze|modular|atx)\b/)) return 'psu';

  // Case
  if (n.match(/\b(boitier|boîtier|case|tower|mid.?tower|full.?tower)\b/)) return 'case';

  // Cooling
  if (n.match(/\b(cooler|refroidissement|ventirad|aio|liquid\s*cooler|watercooling)\b/)) return 'cooling';
  if (n.match(/\b(noctua|deepcool|arctic|thermalright|scythe|id.?cooling|be\s*quiet)\b/) &&
      n.match(/\b(nh|ak|lc|le|se|sl|bk|dk|sk|ld|lf|lp|lx|pure|shadow|dark|silent)\b/)) return 'cooling';

  return null;
}

// ── Spec extractors ───────────────────────────────────────────────────────────

function extractBrand(name: string): string {
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
    '1stPlayer', 'Kolink', 'Sharkoon', 'BitFenix', 'Cougar',
  ];

  for (const brand of BRANDS) {
    if (n.toLowerCase().startsWith(brand.toLowerCase())) return brand;
  }

  // Fall back to first word
  return n.split(/\s+/)[0];
}

function extractCpuSpecs(name: string): { socket: string; tdp: number } | null {
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
    else if (modelNum >= 8000)  socket = 'LGA1151';  // 8th/9th gen
    else if (modelNum >= 6000)  socket = 'LGA1151';  // 6th/7th gen
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

function extractGpuSpecs(name: string): { length_mm: number; tdp: number; vram_gb: number } {
  const n = name.toLowerCase();

  // Extract VRAM from name
  let vram_gb = 8;
  const vramMatch = n.match(/\b(\d+)\s*g[bo]\b/);
  if (vramMatch) vram_gb = parseInt(vramMatch[1]);

  // TDP lookup by model — ordered most specific first
  let tdp = 150;
  // RTX 50 series
  if      (n.match(/\brtx\s*5090\b/))          tdp = 575;
  else if (n.match(/\brtx\s*5080\b/))          tdp = 360;
  else if (n.match(/\brtx\s*5070\s*ti\b/))     tdp = 300;
  else if (n.match(/\brtx\s*5070\b/))          tdp = 250;
  else if (n.match(/\brtx\s*5060\s*ti\b/))     tdp = 180;
  else if (n.match(/\brtx\s*5060\b/))          tdp = 150;
  else if (n.match(/\brtx\s*5050\b/))          tdp = 120;
  // RTX 40 series
  else if (n.match(/\brtx\s*4090\b/))          tdp = 450;
  else if (n.match(/\brtx\s*4080\s*super\b/))  tdp = 320;
  else if (n.match(/\brtx\s*4080\b/))          tdp = 320;
  else if (n.match(/\brtx\s*4070\s*ti\s*super\b/)) tdp = 285;
  else if (n.match(/\brtx\s*4070\s*ti\b/))     tdp = 285;
  else if (n.match(/\brtx\s*4070\s*super\b/))  tdp = 220;
  else if (n.match(/\brtx\s*4070\b/))          tdp = 200;
  else if (n.match(/\brtx\s*4060\s*ti\b/))     tdp = 165;
  else if (n.match(/\brtx\s*4060\b/))          tdp = 115;
  // RTX 30 series
  else if (n.match(/\brtx\s*3090\s*ti\b/))     tdp = 450;
  else if (n.match(/\brtx\s*3090\b/))          tdp = 350;
  else if (n.match(/\brtx\s*3080\s*ti\b/))     tdp = 350;
  else if (n.match(/\brtx\s*3080\b/))          tdp = 320;
  else if (n.match(/\brtx\s*3070\s*ti\b/))     tdp = 290;
  else if (n.match(/\brtx\s*3070\b/))          tdp = 220;
  else if (n.match(/\brtx\s*3060\s*ti\b/))     tdp = 200;
  else if (n.match(/\brtx\s*3060\b/))          tdp = 170;
  else if (n.match(/\brtx\s*3050\b/))          tdp = 130;
  // RTX 20 series
  else if (n.match(/\brtx\s*2080\s*ti\b/))     tdp = 250;
  else if (n.match(/\brtx\s*2080\s*super\b/))  tdp = 250;
  else if (n.match(/\brtx\s*2080\b/))          tdp = 215;
  else if (n.match(/\brtx\s*2070\s*super\b/))  tdp = 215;
  else if (n.match(/\brtx\s*2070\b/))          tdp = 175;
  else if (n.match(/\brtx\s*2060\s*super\b/))  tdp = 175;
  else if (n.match(/\brtx\s*2060\b/))          tdp = 160;
  // GTX 16 series
  else if (n.match(/\bgtx\s*1660\s*ti\b/))     tdp = 120;
  else if (n.match(/\bgtx\s*1660\s*super\b/))  tdp = 125;
  else if (n.match(/\bgtx\s*1660\b/))          tdp = 120;
  else if (n.match(/\bgtx\s*1650\s*super\b/))  tdp = 100;
  else if (n.match(/\bgtx\s*1650\b/))          tdp = 75;
  // GTX 10 series
  else if (n.match(/\bgtx\s*1080\s*ti\b/))     tdp = 250;
  else if (n.match(/\bgtx\s*1080\b/))          tdp = 180;
  else if (n.match(/\bgtx\s*1070\s*ti\b/))     tdp = 180;
  else if (n.match(/\bgtx\s*1070\b/))          tdp = 150;
  else if (n.match(/\bgtx\s*1060\b/))          tdp = 120;
  else if (n.match(/\bgtx\s*1050\s*ti\b/))     tdp = 75;
  else if (n.match(/\bgtx\s*1050\b/))          tdp = 75;
  else if (n.match(/\bgt\s*1030\b/))           tdp = 30;
  else if (n.match(/\bgt\s*730\b/))            tdp = 25;
  // AMD RX 9000 series
  else if (n.match(/\brx\s*9070\s*xt\b/))      tdp = 304;
  else if (n.match(/\brx\s*9070\b/))           tdp = 220;
  else if (n.match(/\brx\s*9060\s*xt\b/))      tdp = 150;
  // AMD RX 7000 series
  else if (n.match(/\brx\s*7900\s*xtx\b/))     tdp = 355;
  else if (n.match(/\brx\s*7900\s*xt\b/))      tdp = 315;
  else if (n.match(/\brx\s*7900\s*gre\b/))     tdp = 260;
  else if (n.match(/\brx\s*7800\s*xt\b/))      tdp = 263;
  else if (n.match(/\brx\s*7700\s*xt\b/))      tdp = 245;
  else if (n.match(/\brx\s*7600\s*xt\b/))      tdp = 190;
  else if (n.match(/\brx\s*7600\b/))           tdp = 165;
  // AMD RX 6000 series
  else if (n.match(/\brx\s*6950\s*xt\b/))      tdp = 335;
  else if (n.match(/\brx\s*6900\s*xt\b/))      tdp = 300;
  else if (n.match(/\brx\s*6800\s*xt\b/))      tdp = 300;
  else if (n.match(/\brx\s*6800\b/))           tdp = 250;
  else if (n.match(/\brx\s*6750\s*xt\b/))      tdp = 250;
  else if (n.match(/\brx\s*6700\s*xt\b/))      tdp = 230;
  else if (n.match(/\brx\s*6700\b/))           tdp = 175;
  else if (n.match(/\brx\s*6650\s*xt\b/))      tdp = 180;
  else if (n.match(/\brx\s*6600\s*xt\b/))      tdp = 160;
  else if (n.match(/\brx\s*6600\b/))           tdp = 132;
  else if (n.match(/\brx\s*6500\s*xt\b/))      tdp = 107;
  else if (n.match(/\brx\s*6400\b/))           tdp = 53;
  // AMD RX 5000 series
  else if (n.match(/\brx\s*5700\s*xt\b/))      tdp = 225;
  else if (n.match(/\brx\s*5700\b/))           tdp = 180;
  else if (n.match(/\brx\s*5600\s*xt\b/))      tdp = 150;
  else if (n.match(/\brx\s*5500\s*xt\b/))      tdp = 130;
  // Intel Arc
  else if (n.match(/\barc\s*b580\b/))          tdp = 190;
  else if (n.match(/\barc\s*b570\b/))          tdp = 150;
  else if (n.match(/\barc\s*a770\b/))          tdp = 225;
  else if (n.match(/\barc\s*a750\b/))          tdp = 225;
  else if (n.match(/\barc\s*a580\b/))          tdp = 185;

  // Estimate length from TDP tier
  let length_mm = 240;
  if      (tdp >= 400) length_mm = 360;
  else if (tdp >= 300) length_mm = 336;
  else if (tdp >= 200) length_mm = 285;
  else if (tdp >= 130) length_mm = 240;
  else                 length_mm = 200;

  return { length_mm, tdp, vram_gb };
}

function extractRamSpecs(name: string): { ram_type: 'DDR4' | 'DDR5'; frequency_mhz: number; capacity_gb: number } | null {
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

function extractStorageSpecs(name: string): { capacity_gb: number; interface_type: string } | null {
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

function extractMotherboardSpecs(name: string): {
  socket: string; chipset: string;
  supported_ram_types: string[]; max_ram_frequency: number;
} | null {
  const n = name.toLowerCase();

  // Extract chipset
  const chipsetMatch = n.match(/\b([abxhz]\d{3,4}[ei]?)\b/);
  if (!chipsetMatch) return null;
  const chipset = chipsetMatch[1].toUpperCase();

  // Determine socket and RAM type from chipset
  const AM5_CHIPSETS = ['X870E', 'X870', 'B850', 'B840', 'B860', 'X670E', 'X670', 'B650E', 'B650', 'A620'];
  const AM4_CHIPSETS = ['X570', 'B550', 'X470', 'B450', 'A520', 'A320', 'B350', 'X370'];
  const LGA1851_CHIPSETS = ['Z890', 'B860', 'B850', 'B840', 'H870'];
  const LGA1700_CHIPSETS = ['Z790', 'Z690', 'B760', 'B660', 'H770', 'H670', 'H610'];
  const LGA1200_CHIPSETS = ['Z590', 'Z490', 'B560', 'B460', 'H570', 'H510', 'H470', 'H410'];
  const LGA1151_CHIPSETS = ['Z390', 'Z370', 'B365', 'B360', 'H370', 'H310'];

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

// ── Clean product name ────────────────────────────────────────────────────────

/**
 * Strips packaging/variant suffixes from a scraped product name to get
 * a clean catalog name. E.g. "AMD Ryzen 5 7600X BOX" → "Ryzen 5 7600X"
 */
function cleanName(rawName: string, brand: string): string {
  let name = rawName
    .replace(new RegExp(`^${brand}\\s*`, 'i'), '')  // strip brand prefix
    .replace(/\s*(BOX|Tray|MPK|OEM|Bulk|no\s*fan|wraith\s*\w+|edition)\s*/gi, ' ')
    .replace(/\s*\(\d+\.?\d*\s*GHz\s*\/\s*\d+\.?\d*\s*GHz\)\s*/gi, '') // strip clock speeds
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ── Main catalog builder ──────────────────────────────────────────────────────

/**
 * For each pending unmatched listing that couldn't be matched by autoMap(),
 * attempts to extract specs from the product name and create a new catalog entry.
 * Then creates a scraper_mapping so the next scrape prices it correctly.
 *
 * @param onProgress - optional callback called after each listing is processed
 */
export async function buildFromUnmatched(onProgress?: (done: number, total: number) => void): Promise<BuildResult> {
  let created = 0;
  let skipped = 0;

  // Only process listings that are still pending (autoMap already ran)
  const pending = (await _sql`
    SELECT ul.id, ul.retailer_id, ul.product_url, ul.scraped_name
    FROM unmatched_listings ul
    WHERE ul.status = 'pending'
      AND ul.scraped_name IS NOT NULL
      AND ul.scraped_name != ''
    ORDER BY ul.scraped_at DESC
  `) as { id: number; retailer_id: number; product_url: string; scraped_name: string }[];

  if (pending.length === 0) return { created, skipped };

  // Load existing slugs for deduplication
  const existingSlugsRows = (await _sql`
    SELECT slug FROM components WHERE slug IS NOT NULL
  `) as { slug: string }[];
  const existingSlugs = new Set(existingSlugsRows.map(r => r.slug));

  // Load existing components for DNA dedup check
  const existingComponents = (await _sql`
    SELECT id, name, brand, category FROM components WHERE is_active = true
  `) as CatalogComponent[];

  for (const listing of pending) {
    const category = inferCategory(listing.scraped_name);
    if (!category) { skipped++; continue; }

    // Only auto-create for categories where we can reliably extract specs
    // Case, cooling, PSU have too many variants — leave for admin review
    if (!['cpu', 'gpu', 'ram', 'storage', 'motherboard'].includes(category)) {
      skipped++;
      continue;
    }

    const brand = extractBrand(listing.scraped_name);
    const cleanedName = cleanName(listing.scraped_name, brand);

    // DNA dedup: check if a component with the same DNA already exists
    // (catches "Ryzen 5 7600X BOX" when "Ryzen 5 7600X" is already in catalog)
    // For storage: require a stricter match — model name must be present in both
    const minScore = category === 'storage' ? 1.0 : 1.0;
    const dnaMatch = existingComponents.find(c => {
      if (c.category !== category) return false;
      const { score } = scoreDnaMatch(listing.scraped_name, `${c.brand ?? ''} ${c.name}`, category);
      return score >= minScore;
    });

    if (dnaMatch) {
      // Already exists — just create the mapping
      try {
        await _sql`
          INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
          VALUES (${dnaMatch.id}, ${listing.retailer_id}, ${listing.product_url}, ${listing.scraped_name})
          ON CONFLICT (retailer_id, product_url) DO NOTHING
        `;
        await _sql`
          UPDATE unmatched_listings SET status = 'linked', linked_component_id = ${dnaMatch.id}
          WHERE id = ${listing.id}
        `;
        created++; // counts as resolved
      } catch { skipped++; }
      continue;
    }

    // Extract specs for the category
    let insertResult: { id: number }[] = [];

    try {
      if (category === 'cpu') {
        const specs = extractCpuSpecs(listing.scraped_name);
        if (!specs) { skipped++; continue; }
        const slug = generateUniqueSlug(componentSlug(brand, cleanedName), existingSlugs);
        existingSlugs.add(slug);
        insertResult = (await _sql`
          INSERT INTO components (slug, name, brand, category, socket, tdp, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'cpu', ${specs.socket}, ${specs.tdp}, true)
          ON CONFLICT (slug) DO NOTHING
          RETURNING id
        `) as { id: number }[];

      } else if (category === 'gpu') {
        const specs = extractGpuSpecs(listing.scraped_name);
        const slug = generateUniqueSlug(componentSlug(brand, cleanedName), existingSlugs);
        existingSlugs.add(slug);
        insertResult = (await _sql`
          INSERT INTO components (slug, name, brand, category, length_mm, tdp, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'gpu', ${specs.length_mm}, ${specs.tdp}, true)
          ON CONFLICT (slug) DO NOTHING
          RETURNING id
        `) as { id: number }[];

      } else if (category === 'ram') {
        const specs = extractRamSpecs(listing.scraped_name);
        if (!specs) { skipped++; continue; }
        const slug = generateUniqueSlug(componentSlug(brand, cleanedName), existingSlugs);
        existingSlugs.add(slug);
        insertResult = (await _sql`
          INSERT INTO components (slug, name, brand, category, ram_type, frequency_mhz, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'ram', ${specs.ram_type}, ${specs.frequency_mhz}, true)
          ON CONFLICT (slug) DO NOTHING
          RETURNING id
        `) as { id: number }[];

      } else if (category === 'storage') {
        const specs = extractStorageSpecs(listing.scraped_name);
        if (!specs) { skipped++; continue; }
        const slug = generateUniqueSlug(componentSlug(brand, cleanedName), existingSlugs);
        existingSlugs.add(slug);
        insertResult = (await _sql`
          INSERT INTO components (slug, name, brand, category, is_active)
          VALUES (${slug}, ${cleanedName}, ${brand}, 'storage', true)
          ON CONFLICT (slug) DO NOTHING
          RETURNING id
        `) as { id: number }[];

      } else if (category === 'motherboard') {
        const specs = extractMotherboardSpecs(listing.scraped_name);
        if (!specs) { skipped++; continue; }
        const slug = generateUniqueSlug(componentSlug(brand, cleanedName), existingSlugs);
        existingSlugs.add(slug);
        insertResult = (await _sql`
          INSERT INTO components (
            slug, name, brand, category, socket,
            supported_ram_types, max_ram_frequency, is_active
          )
          VALUES (
            ${slug}, ${cleanedName}, ${brand}, 'motherboard', ${specs.socket},
            ${specs.supported_ram_types}, ${specs.max_ram_frequency}, true
          )
          ON CONFLICT (slug) DO NOTHING
          RETURNING id
        `) as { id: number }[];
      }

      if (insertResult.length === 0) { skipped++; continue; }

      const newId = insertResult[0].id;

      // Add to in-memory catalog for subsequent DNA dedup checks
      existingComponents.push({ id: newId, name: cleanedName, brand, category });

      // Create scraper_mapping
      await _sql`
        INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
        VALUES (${newId}, ${listing.retailer_id}, ${listing.product_url}, ${listing.scraped_name})
        ON CONFLICT (retailer_id, product_url) DO NOTHING
      `;

      // Mark listing as linked
      await _sql`
        UPDATE unmatched_listings SET status = 'linked', linked_component_id = ${newId}
        WHERE id = ${listing.id}
      `;

      created++;
    } catch {
      skipped++;
    }

    onProgress?.(created + skipped, pending.length);
  }

  if (created > 0) {
    await logger.info(`Catalog builder: ${created} new component(s) created from scraped data, ${skipped} skipped`);
  }

  return { created, skipped };
}
