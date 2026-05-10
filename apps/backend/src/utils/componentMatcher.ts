/**
 * componentMatcher.ts — Smart category-aware product name matching.
 *
 * Instead of generic fuzzy matching (which confuses RTX 4070 with RTX 4080),
 * this module extracts structured "DNA" tokens per component category:
 *   - GPU: brand + chipset model (e.g. "rtx4090", "rx7900xtx")
 *   - CPU: brand + model number (e.g. "ryzen5", "7600x", "i7", "13700k")
 *   - RAM: capacity + speed + type (e.g. "32gb", "ddr5", "6000")
 *   - Storage: capacity + interface (e.g. "1tb", "nvme", "sata")
 *   - PSU: wattage + certification (e.g. "850w", "gold")
 *   - Motherboard: chipset + socket (e.g. "b650", "am5", "z790", "lga1700")
 *   - Case: form factor (e.g. "atx", "matx", "itx")
 *   - Cooling: type + size (e.g. "240mm", "aio", "noctua")
 *
 * Two products match only if ALL extracted DNA tokens from the catalog entry
 * are present in the scraped product name. This prevents false positives like
 * "RTX 4070" matching "RTX 4080".
 *
 * Based on Gemini recommendations for PC hardware matching.
 * Matching strategy: each DNA token is converted to a space-tolerant regex
 * (e.g. "rtx4090" → /\brtx\s*4090\b/i) so "RTX 4090" and "RTX4090" both match,
 * while \b word boundaries prevent "rx7900xt" from matching "rx7900xtx".
 */

import { extractBrand, CATEGORY_WORDS } from '@shared/component-utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MatchResult {
  componentId: number;
  score: number;       // 0–1, 1 = all DNA tokens matched
  dnaTokens: string[]; // tokens extracted from catalog component
}

export interface CatalogComponent {
  id: number;
  name: string;
  brand: string | null;
  category: string;
}

// ── Normalization helpers ─────────────────────────────────────────────────────

/** Lowercase, strip punctuation, collapse whitespace. */
function normalize(text: string): string {
  if (!text) return '';
  let n = text.toLowerCase();

  // Strip category keywords specifically to handle concatenated suffixes like "5600XTProcesseurs"
  // We use a regex that matches the words in CATEGORY_WORDS
  for (const word of CATEGORY_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match at end of string or before boundary, even if concatenated with letters
    const regex = new RegExp(`${escaped}\\s*$`, 'gi');
    n = n.replace(regex, '');
  }

  return n
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Category-specific DNA extractors ─────────────────────────────────────────

/**
 * GPU DNA: chipset model number including suffix (e.g. "rtx4090", "rtx4070tisuper", "rx7900xtx")
 * The suffix (Ti, SUPER, Ti SUPER) is part of the DNA — without it, 4070 matches 4070 Ti.
 */
function extractGpuDna(name: string): string[] {
  const n = normalize(name);
  const tokens: string[] = [];

  // NVIDIA RTX/GTX — token-based suffix detection.
  // Retailers insert noise tokens (OC, GAMING, DUAL, TRIPLE, etc.) between the model
  // number and the suffix (Ti, SUPER). We scan the full string for suffix tokens
  // rather than requiring them to appear immediately after the model number.
  // e.g. "RTX 4070 OC SUPER" and "RTX 4070 SUPER OC" both resolve to "rtx4070super".
  const rtxMatch = n.match(/\b(rtx|gtx)\s*(\d{4})\b/);
  if (rtxMatch) {
    const base = `${rtxMatch[1]}${rtxMatch[2]}`;
    // Check for suffix tokens anywhere in the string (order: ti super > ti > super)
    const hasTi = /\bti\b/.test(n);
    const hasSuper = /\bsuper\b/.test(n);
    const suffix = hasTi && hasSuper ? 'tisuper' : hasTi ? 'ti' : hasSuper ? 'super' : '';
    tokens.push(`${base}${suffix}`);
    return tokens;
  }

  // AMD RX — same token-based approach for xtx/xt/gre/m suffixes
  const rxMatch = n.match(/\brx\s*(\d{4})\b/);
  if (rxMatch) {
    const base = `rx${rxMatch[1]}`;
    const hasXtx = /\bxtx\b/.test(n);
    const hasXt = /\bxt\b/.test(n);
    const hasGre = /\bgre\b/.test(n);
    const hasM = /\b(\d{4})\s*m\b/.test(n); // only "m" directly after model number
    const suffix = hasXtx ? 'xtx' : hasXt ? 'xt' : hasGre ? 'gre' : hasM ? 'm' : '';
    tokens.push(`${base}${suffix}`);
    return tokens;
  }

  // Intel Arc — covers A-series (A750) and B-series (B580, B570)
  const arcMatch = n.match(/\barc\s*([ab]\d{3})\b/);
  if (arcMatch) {
    tokens.push(`arc${arcMatch[1]}`);
    return tokens;
  }

  // Fallback: use all numeric tokens (model numbers)
  return n.split(' ').filter((t) => /\d/.test(t) && t.length >= 3);
}

/**
 * CPU DNA: family + model number (e.g. "ryzen5", "7600x", "i7", "13700k")
 * Both the family AND the model number must match.
 */
function extractCpuDna(name: string): string[] {
  const n = normalize(name);
  const tokens: string[] = [];

  // AMD Ryzen (including Ryzen 3/5/7/9 and Ryzen PRO)
  const ryzenMatch = n.match(/\bryzen\s*(\d)\b/);
  if (ryzenMatch) tokens.push(`ryzen${ryzenMatch[1]}`);

  // Intel Core Ultra X (Arrow Lake / Meteor Lake naming: Core Ultra 5/7/9)
  const ultraMatch = n.match(/\bcore\s*ultra\s*(\d)\b/);
  if (ultraMatch) tokens.push(`ultra${ultraMatch[1]}`);

  // Intel Core iX (classic naming: i3/i5/i7/i9)
  if (!ultraMatch) {
    const intelMatch = n.match(/\b(core\s*)?(i[3579])\b/);
    if (intelMatch) tokens.push(intelMatch[2].replace(/\s/g, ''));
  }

  // Model number — allow up to 8 alphanumeric chars after digits (e.g. 7950x3d, 13700kf, 285k, 5600xt)
  // We use a global match to find all numbers, as products often have specs in name
  const modelMatches = n.matchAll(/\b(\d{3,5}[a-z0-9]{0,6})\b/g);
  for (const match of modelMatches) {
    tokens.push(match[1]);
  }

  // Threadripper / EPYC
  if (n.includes('threadripper')) tokens.push('threadripper');
  if (n.includes('epyc')) tokens.push('epyc');

  return [...new Set(tokens.filter(Boolean))]; // Dedup
}

/**
 * RAM DNA: capacity + type + speed
 * e.g. "32gb", "ddr5", "6000" — all three must match.
 */
function extractRamDna(name: string): string[] {
  const n = normalize(name);
  const tokens: string[] = [];

  // Capacity: 8gb, 16gb, 32gb, 64gb — also handles "2x16gb" → "32gb"
  const kitMatch = n.match(/(\d+)\s*x\s*(\d+)\s*gb/);
  if (kitMatch) {
    tokens.push(`${parseInt(kitMatch[1]) * parseInt(kitMatch[2])}gb`);
  } else {
    const capMatch = n.match(/\b(\d+)\s*gb\b/);
    if (capMatch) tokens.push(`${capMatch[1]}gb`);
  }

  // Type: DDR4, DDR5
  const typeMatch = n.match(/\b(ddr[45])\b/);
  if (typeMatch) tokens.push(typeMatch[1]);

  // Speed: 3200, 5600, 6000 MHz
  const speedMatch = n.match(/\b(\d{4,5})\s*(mhz)?\b/);
  if (speedMatch && parseInt(speedMatch[1]) >= 2133) {
    tokens.push(speedMatch[1]);
  }

  return tokens.filter(Boolean);
}

/**
 * Storage DNA: model name tokens + capacity + interface type
 * e.g. ["970", "evo", "plus", "1tb", "nvme"] — model name prevents 970 matching 980.
 */
function extractStorageDna(name: string): string[] {
  const n = normalize(name);
  const tokens: string[] = [];

  // Capacity: 500gb, 1tb, 2tb, 4tb
  const tbMatch = n.match(/\b(\d+)\s*tb\b/);
  const gbMatch = n.match(/\b(\d{3,4})\s*gb\b/);
  if (tbMatch) tokens.push(`${tbMatch[1]}tb`);
  else if (gbMatch) tokens.push(`${gbMatch[1]}gb`);

  // Interface
  if (n.includes('nvme') || n.includes('m 2') || n.includes('m2')) tokens.push('nvme');
  else if (n.includes('sata')) tokens.push('sata');

  // Model name tokens — critical for distinguishing 970/980/990, SN770/SN850X, etc.
  // Strip only truly generic words — keep brand names and model identifiers.
  // NOTE: 'evo', 'pro', 'plus' are intentionally NOT in the noise list because
  // they distinguish "870 EVO" from "870 QVO", "980 PRO" from "980", etc.
  const noise = new Set(['ssd', 'hdd', 'nvme', 'sata', 'internal', 'solid', 'state',
    'drive', 'hard', 'disk', 'pcie', 'gen', 'the', 'and', 'with',
    'wd', 'western', 'digital']); // only strip ambiguous abbreviations, not brand names

  // Extract model-specific tokens (alphanumeric, not pure capacity/interface)
  const modelTokens = n.split(' ').filter((t) => {
    if (t.length < 2) return false;
    if (noise.has(t)) return false;
    if (/^\d+tb$/.test(t) || /^\d+gb$/.test(t)) return false; // already captured
    if (t === 'nvme' || t === 'sata') return false;
    // Keep tokens that look like model identifiers (mix of letters/digits, or pure numbers like 970)
    return /\d/.test(t) || t.length >= 3;
  });
  tokens.push(...modelTokens.slice(0, 4)); // take up to 4 model tokens for storage

  return tokens.filter(Boolean);
}

/**
 * PSU DNA: brand + wattage + efficiency rating
 * e.g. "corsair", "850w", "gold"
 * Brand AND wattage are both required — brand alone is too weak.
 * If wattage cannot be determined, returns empty DNA (no match).
 *
 * Guard: reject names that look like motherboard chipsets (B650, X870, etc.)
 * but only when the name has NO wattage indicator at all. This prevents
 * chipset numbers from being mistaken for wattage, while still allowing
 * PSU model names like "A650BN" (Seasonic) that embed wattage in the model.
 */
function extractPsuDna(name: string): string[] {
  const n = normalize(name);
  const tokens: string[] = [];

  // Guard: if the name looks like a motherboard chipset AND has no wattage indicator, skip.
  // A motherboard name like "B650 GAMING PLUS" has no W suffix and no PSU brand.
  // A PSU like "Seasonic A650BN" has a known PSU brand, so the brand check below
  // will succeed and we proceed normally.
  const hasAnyWattageHint = n.match(/\b\d{3,4}\s*w\b/) ||
    n.match(/\b(cv|rm|tx|cx|hx|sf|ax|vs|cp|lp|gx|gm|gd|focus|prime|straight|dark|a|p|g|v|mwe|strix|tuf|rog)(\d{3,4})[a-z]{0,3}\b/);
  if (!hasAnyWattageHint && n.match(/\b[abxhz]\d{3,4}[ei]?\b/)) return [];

  // Brand — extract first word if it's a known PSU brand
  const PSU_BRANDS = new Set([
    'corsair', 'seasonic', 'evga', 'bequiet', 'be', 'coolermaster', 'thermaltake',
    'antec', 'fractal', 'silverstone', 'fsp', 'superflower', 'xpg', 'asus',
    'gigabyte', 'msi', 'deepcool', 'aerocool', 'cougar', 'chieftec', 'lc',
  ]);
  const firstWord = n.split(' ')[0];
  if (PSU_BRANDS.has(firstWord)) {
    tokens.push(firstWord);
  } else if (n.includes('be quiet') || n.includes('be-quiet')) {
    tokens.push('bequiet');
  }

  // Wattage — explicit "850W" takes priority (must have W suffix)
  const wattMatch = n.match(/\b(\d{3,4})\s*w\b/);
  if (wattMatch) {
    tokens.push(`${wattMatch[1]}w`);
  } else {
    // Wattage with efficiency suffix: "850G" (Gold), "850X" (Platinum), "850P" etc.
    // Only match if NOT preceded by a letter (avoids B850, X870 chipset patterns)
    const wattSuffixMatch = n.match(/(?<![a-z])(\d{3,4})[gxpbt]\b/);
    if (wattSuffixMatch) {
      const w = parseInt(wattSuffixMatch[1]);
      if (w >= 300 && w <= 2000) tokens.push(`${w}w`);
    } else {
      // Model number contains wattage (e.g. CV550, RM750, TX850, CX650, A650BN)
      const PSU_MODEL_PREFIXES = /\b(cv|rm|tx|cx|hx|sf|ax|vs|cp|lp|gx|gm|gd|a|p|g|v|mwe|strix|tuf|rog)(\d{3,4})[a-z]{0,3}\b/;
      const modelWattMatch = n.match(PSU_MODEL_PREFIXES);
      if (modelWattMatch) {
        const w = parseInt(modelWattMatch[2]);
        if (w >= 300 && w <= 2000) tokens.push(`${w}w`);
      }
    }
  }

  // Efficiency
  if (n.includes('titanium')) tokens.push('titanium');
  else if (n.includes('platinum')) tokens.push('platinum');
  else if (n.includes('gold')) tokens.push('gold');
  else if (n.includes('bronze')) tokens.push('bronze');

  // Require at least brand + wattage — brand alone is too weak
  const hasWattage = tokens.some(t => t.endsWith('w'));
  if (!hasWattage) return []; // can't reliably match without wattage

  return tokens.filter(Boolean);
}

/**
 * Motherboard DNA: chipset + socket + model name tokens
 *
 * Chipset alone is not enough — "GIGABYTE Z790 D" and "GIGABYTE Z790 S" both
 * have chipset "z790". We must also include the model suffix tokens so the
 * matcher can distinguish them.
 *
 * e.g. "GIGABYTE Z790 D"         → ["z790", "d"]
 *      "GIGABYTE Z790 S"         → ["z790", "s"]
 *      "MSI MAG Z790 TOMAHAWK"   → ["z790", "tomahawk"]
 *      "ASUS ROG STRIX B650E-F"  → ["b650e", "strix", "b650e", "f"]  (strix + suffix)
 *      "ASRock B650 Steel Legend" → ["b650", "steel", "legend"]
 */
function extractMotherboardDna(name: string): string[] {
  const n = normalize(name);
  const tokens: string[] = [];

  // Chipset: B650, X670, B760, Z790, H610, A520, A620, TRX40, WRX80, etc.
  // Covers AMD (A/B/X) and Intel (B/H/Z) chipsets, plus HEDT (TRX/WRX)
  const chipsetMatch = n.match(/\b([abhtwxz]\d{3,4}[ei]?)\b/);
  if (chipsetMatch) tokens.push(chipsetMatch[1]);

  // Socket
  if (n.includes('am5')) tokens.push('am5');
  else if (n.includes('am4')) tokens.push('am4');
  else if (n.includes('lga1851') || n.includes('lga 1851')) tokens.push('lga1851');
  else if (n.includes('lga1700') || n.includes('lga 1700')) tokens.push('lga1700');
  else if (n.includes('lga1200') || n.includes('lga 1200')) tokens.push('lga1200');

  // Model name tokens — what distinguishes boards with the same chipset.
  // Strip generic noise words and the chipset/socket tokens already captured.
  // Keep short tokens (even single letters like "d", "s") because they are
  // the actual model differentiators (Z790 D vs Z790 S, B650M DS3H, etc.)
  const noise = new Set([
    'wifi', 'ax', 'atx', 'matx', 'itx', 'ddr4', 'ddr5',
    'am4', 'am5', 'lga1700', 'lga1851', 'lga1200',
    'gaming', 'gen', 'pcie', 'usb', 'rgb', 'argb',
    'asus', 'msi', 'gigabyte', 'asrock', 'biostar', 'evga',
    'rog', 'tuf', 'prime', 'pro', 'mag', 'meg', 'mpg',
  ]);

  // Remove the chipset token from the name before extracting model tokens
  // so we don't double-count it
  const chipset = chipsetMatch ? chipsetMatch[1] : '';
  const withoutChipset = n.replace(new RegExp(`\\b${chipset}\\b`, 'g'), '').trim();

  const modelTokens = withoutChipset
    .split(' ')
    .filter((t) => t.length >= 1 && !noise.has(t) && !/^\d+$/.test(t));

  // Take up to 3 model tokens — enough to distinguish variants without over-constraining
  tokens.push(...modelTokens.slice(0, 3));

  return tokens.filter(Boolean);
}

/**
 * Case DNA: form factor + brand model
 * e.g. "atx", "matx", "itx" + model name tokens
 *
 * Color tokens (black, white, etc.) are intentionally kept — they are primary
 * differentiators for many cases (e.g. Lian Li O11 Dynamic Black vs White).
 */
function extractCaseDna(name: string): string[] {
  const n = normalize(name);
  const tokens: string[] = [];

  if (n.includes('mini itx') || n.includes('itx')) tokens.push('itx');
  else if (n.includes('micro atx') || n.includes('matx') || n.includes('m atx')) tokens.push('matx');
  else tokens.push('atx');

  // Model name tokens — strip generic structural noise but keep color and model identifiers.
  // Colors (black, white, pink, etc.) are kept because they distinguish product variants.
  const noise = new Set(['atx', 'matx', 'itx', 'tower', 'case', 'boitier', 'gaming',
    'tempered', 'glass', 'tg', 'rgb', 'argb', 'mid', 'full', 'mini']);
  const modelTokens = n.split(' ').filter((t) => t.length > 2 && !noise.has(t) && !/^\d+$/.test(t));
  tokens.push(...modelTokens.slice(0, 5)); // take up to 5 model tokens to capture brand + model + color

  return tokens.filter(Boolean);
}

/**
 * Cooling DNA: type (air/aio) + size + brand model
 *
 * Color tokens (black, white, etc.) are intentionally kept — they distinguish
 * variants like Noctua NH-D15 vs NH-D15 chromax.black.
 *
 * For air coolers, we do NOT add a synthetic "air" token because scraped product
 * names rarely contain the word "air" — it would cause all air cooler catalog
 * entries to fail matching. Instead we rely on model name tokens only.
 */
function extractCoolingDna(name: string): string[] {
  const n = normalize(name);
  const tokens: string[] = [];

  // 1. Radiator Size (handle 120, 140, 240, 280, 360, 420)
  // Handle "360mm", "360L", "360", etc.
  const sizeMatch = n.match(/\b(120|140|240|280|360|420)(?:\s*mm|\s*l|\b)/i);
  if (sizeMatch) {
    tokens.push(`${sizeMatch[1]}mm`);
  }

  // 2. Cooling Type
  if (n.includes('aio') || n.includes('liquid') || n.includes('water') || sizeMatch) {
    tokens.push('aio');
  }

  // 3. Model tokens — ALWAYS include these to distinguish between different AIOs/Air coolers
  // e.g. "MasterLiquid", "Core", "ARGB", "Elite", "Halo", "NH-D15"
  const noise = new Set(['cooler', 'cpu', 'air', 'tower', 'fan', 'rgb', 'argb', 'aio', 'liquid', 'water', 'refroidissement']);
  const modelTokens = n.split(' ').filter((t) => {
    if (t.length <= 2) return false;
    if (noise.has(t)) return false;
    if (/^\d+(mm|l)?$/.test(t)) return false; // already captured as size
    if (/^\d+$/.test(t) && parseInt(t) > 50 && parseInt(t) < 500) return false; // likely size
    return true;
  });

  tokens.push(...modelTokens.slice(0, 4));

  return tokens.filter(Boolean);
}

// ── Main DNA extractor ────────────────────────────────────────────────────────

/**
 * Extracts the "DNA" of a component — the minimal set of tokens that
 * uniquely identify it within its category.
 */
export function extractDna(name: string, category: string): string[] {
  switch (category) {
    case 'gpu': return extractGpuDna(name);
    case 'cpu': return extractCpuDna(name);
    case 'ram': return extractRamDna(name);
    case 'storage': return extractStorageDna(name);
    case 'psu': return extractPsuDna(name);
    case 'motherboard': return extractMotherboardDna(name);
    case 'case': return extractCaseDna(name);
    case 'cooling': return extractCoolingDna(name);
    default: return normalize(name).split(' ').filter((t) => t.length > 2);
  }
}

// ── Token → Regex ─────────────────────────────────────────────────────────────

/**
 * Converts a dense DNA token (e.g. "rtx4090", "rx7900xtx", "7600x") into a
 * space-tolerant regex that matches the token in a naturally-spaced product title.
 *
 * Strategy (Gemini recommendation):
 * - Insert `\s*` at every letter↔digit boundary within the token
 * - Wrap with `\b` word boundaries
 *
 * Examples:
 *   "rtx4090"   → /\brtx\s*4090\b/i   matches "RTX 4090", "RTX4090"
 *   "rx7900xtx" → /\brx\s*7900\s*xtx\b/i  matches "RX 7900 XTX" but NOT "RX 7900 XT"
 *   "7600x"     → /\b7600\s*x\b/i     matches "7600X" but NOT "7600"
 *   "ryzen5"    → /\bryzen\s*5\b/i     matches "Ryzen 5" and "Ryzen5"
 */
const regexCache = new Map<string, RegExp>();

export function tokenToRegex(token: string): RegExp {
  if (regexCache.has(token)) return regexCache.get(token)!;

  // Insert \s* at every letter↔digit boundary
  let pattern = token
    .replace(/([a-z])(\d)/g, '$1\\s*$2')
    .replace(/(\d)([a-z])/g, '$1\\s*$2');

  // Also handle known multi-word GPU suffixes that get concatenated in DNA tokens:
  // "tisuper" → "ti\s*super", so "RTX 4070 Ti SUPER" matches token "rtx4070tisuper"
  pattern = pattern.replace(/ti(\\s\*)?super/i, 'ti\\s*super');

  const regex = new RegExp(`\\b${pattern}\\b`, 'i');
  regexCache.set(token, regex);
  return regex;
}

// ── Matcher ───────────────────────────────────────────────────────────────────

/**
 * Checks if all DNA tokens from the catalog component appear in the
 * scraped product name. Returns a score 0–1.
 *
 * Score = matched_dna_tokens / total_dna_tokens
 * A score of 1.0 means all DNA tokens matched → high confidence.
 * A score < 1.0 means some tokens are missing → likely a different product.
 *
 * Uses space-tolerant regex per token (Gemini recommendation) — no string
 * compaction needed. Each DNA token is converted to a regex that tolerates
 * optional spaces at letter↔digit boundaries, while \b prevents substring
 * matches ("rx7900xt" won't match "rx7900xtx").
 */
export function scoreDnaMatch(productName: string, catalogName: string, category: string, skipBrandCheck = false): {
  score: number;
  dnaTokens: string[];
} {
  if (!productName || !catalogName) return { score: 0, dnaTokens: [] };
  if (!skipBrandCheck) {
    const pBrand = extractBrand(productName);
    const cBrand = extractBrand(catalogName);

    // Strict Brand Enforcement:
    // If we found a specific brand in BOTH and they don't match, it's a 0.
    // This prevents an MSI PSU from matching a Cooler Master PSU just because they are both 1000W.
    //
    // Exception for GPUs: catalog entries use the chip manufacturer (NVIDIA/AMD) as brand,
    // but scraped products use the AIB partner (Gigabyte, ASUS, MSI, Sapphire, etc.).
    // We skip brand enforcement for GPUs to allow AIB partner products to match chip-brand catalog entries.
    const GPU_CHIP_BRANDS = new Set(['nvidia', 'amd', 'intel']);
    const isGpuWithChipBrand = category === 'gpu' && cBrand && GPU_CHIP_BRANDS.has(cBrand.toLowerCase());
    if (pBrand && cBrand && pBrand.toLowerCase() !== cBrand.toLowerCase() && !isGpuWithChipBrand) {
      return { score: 0, dnaTokens: [] };
    }
  }

  const dnaTokens = extractDna(catalogName, category);
  if (dnaTokens.length === 0) return { score: 0, dnaTokens: [] };

  // Keep the product name naturally spaced — just lowercase and strip punctuation
  // Also normalize speed notation: "3200MHz" → "3200" so speed tokens match
  // Also normalize RAM kit notation: "2x8GB" → "16GB", "2x16GB" → "32GB"
  // For PSU: expand model-embedded wattage (e.g. "CV550" → "CV550 550w")
  // but ONLY for known PSU model prefixes to avoid false positives with motherboard chipsets
  let productNorm = normalize(productName)
    .replace(/(\d+)\s*mhz/g, '$1')
    .replace(/(\d+)\s*x\s*(\d+)\s*gb/g, (_m, count, size) => `${parseInt(count) * parseInt(size)}gb`);

  if (category === 'psu') {
    // Expand "850G" → "850w", "850X" → "850w" (efficiency suffix variants)
    productNorm = productNorm.replace(/\b(\d{3,4})[gxpbt]\b/g, (match, watts) => {
      const w = parseInt(watts);
      return w >= 300 && w <= 2000 ? `${match} ${watts}w` : match;
    });
    // Expand model-embedded wattage (e.g. "CV550" → "CV550 550w")
    productNorm = productNorm.replace(
      /\b(cv|rm|tx|cx|hx|sf|ax|vs|cp|lp|gx|gm|gd|focus|prime|straight|dark|a|p|g|v|mwe|strix|tuf|rog)(\d{3,4})[a-z]{0,3}\b/g,
      (match, _prefix, watts) => {
        const w = parseInt(watts);
        return w >= 300 && w <= 2000 ? `${match} ${watts}w` : match;
      }
    );
  }

  let matched = 0;
  for (const token of dnaTokens) {
    const regex = tokenToRegex(token);
    if (regex.test(productNorm)) matched++;
  }

  return { score: matched / dnaTokens.length, dnaTokens };
}

/**
 * Finds the best matching catalog component for a scraped product name.
 *
 * Uses DNA matching: requires ALL DNA tokens to match (score = 1.0).
 * Falls back to best partial match if no perfect match found.
 *
 * Key insight: scoring is done using the CATALOG ENTRY'S category, not the
 * product's inferred category. This means a RAM product is scored against
 * each catalog entry using that entry's DNA extractor. A motherboard entry
 * has chipset+socket DNA — a RAM product name won't contain those tokens,
 * so the score will be low. This prevents cross-category false positives.
 *
 * Rejects bundle products: if the product name contains DNA tokens from
 * 2+ major categories simultaneously, it's likely a pre-built PC or bundle.
 *
 * @param productName - scraped product title
 * @param components  - catalog components to match against
 * @param minScore    - minimum score to accept (default 1.0 = perfect DNA match)
 */
export function findBestMatch(
  productName: string,
  components: CatalogComponent[],
  minScore = 1.0,
): MatchResult | null {
  // Bundle detection: count how many distinct MAJOR categories have a perfect DNA match.
  // Use brand-agnostic scoring here — a bundle like "PC Gamer Ryzen 5 7600X RTX 4090" should
  // be detected even if the product brand doesn't match the catalog brand.
  const MAJOR_CATEGORIES = new Set(['cpu', 'gpu', 'motherboard']);
  const matchingCategories = new Set<string>();
  for (const component of components) {
    const fullName = component.brand ? `${component.brand} ${component.name}` : component.name;
    const { score } = scoreDnaMatch(productName, fullName, component.category, true /* skipBrandCheck */);
    if (score >= 1.0) matchingCategories.add(component.category);
    if (matchingCategories.size >= 2 && [...matchingCategories].some((c) => MAJOR_CATEGORIES.has(c))) {
      return null; // bundle — reject
    }
  }

  let best: MatchResult | null = null;
  let bestSpecificity = -1;

  for (const component of components) {
    const fullName = component.brand
      ? `${component.brand} ${component.name}`
      : component.name;

    const { score, dnaTokens } = scoreDnaMatch(productName, fullName, component.category);

    // Require minimum DNA token count to avoid trivially short DNA matching everything.
    // A catalog entry with only 1 DNA token that is just a RAM type (ddr4/ddr5) is
    // too weak — it would match any product containing that RAM type.
    // Exception: GPU and CPU can have 1 token (chipset model is sufficient).
    if (dnaTokens.length === 1 &&
      !['gpu', 'cpu'].includes(component.category) &&
      (dnaTokens[0] === 'ddr4' || dnaTokens[0] === 'ddr5')) continue;

    const specificity = dnaTokens.reduce((sum, t) => sum + t.length, 0);

    if (score > (best?.score ?? -1) || (best !== null && score === best.score && specificity > bestSpecificity)) {
      best = { componentId: component.id, score, dnaTokens };
      bestSpecificity = specificity;
    }
  }

  if (best && best.score >= minScore) return best;
  return null;
}
