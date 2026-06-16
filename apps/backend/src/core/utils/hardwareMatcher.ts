/**
 * hardwareMatcher.ts — Systemic Product Matching Engine.
 * 
 * Implements strict architectural rules to prevent false positives in product matching:
 * 1. Strict Brand Enforcement (20%)
 * 2. Strict Spec (DNA) Enforcement (40%)
 * 3. Strict Series/Sub-tier Enforcement (40%) - Negative Exclusion Engine
 * 4. Ambiguity Rejection (fails if multiple masters match)
 */

import { extractBrand } from '@shared/hardware/brands';
import { extractDna, tokenToRegex } from './componentMatcher';

// ── Series / Sub-tier Definitions ──────────────────────────────────────────

/**
 * Tokens that define a product's sub-tier or series.
 * Matching these is critical to distinguish between "ASUS PRIME" and "ASUS ROG".
 */
export const SERIES_TOKENS_BY_CATEGORY: Record<string, string[]> = {
  gpu: [
    'ROG', 'STRIX', 'TUF', 'DUAL', 'PHOENIX', 'SUPRIM', 'GAMING TRIO', 'VENTUS',
    'STEALTH', 'EXPERT', 'AORUS', 'EAGLE', 'WINDFORCE', 'WATERFORCE', 'VISION',
    'AERO', 'GAMING OC', 'ELITE', 'MASTER', 'XTREME', 'WIND FORCE', 'TAICHI',
    'STEEL LEGEND', 'PHANTOM', 'VELOCITA', 'PRO4', 'PRO', 'ANNIVERSARY', 'CHALLENGER',
    'AQUA', 'LEGEND', 'PG', 'FTW3', 'XC3', 'SC', 'SSC', 'FTW', 'KINGPIN',
    'NITRO', 'PULSE', 'PURE', 'RED DEVIL', 'RED DRAGON', 'HELLHOUND', 'FIGHTER',
    'AMP', 'TRINITY', 'HOLOPINK', 'TWIN EDGE', 'HOLO', 'GAMEROCK', 'GAMINGPRO',
    'JETSTREAM', 'GHOST', 'PANTHER', 'MERC', 'QICK', 'SWFT', 'ICHILL', 'X3', 'X2',
    'CORE', 'ULTRA', 'PLUS'
  ],
  motherboard: [
    'ROG', 'STRIX', 'TUF', 'PRIME', 'PROART', 'MAXIMUS', 'CROSSHAIR', 'HERO',
    'APEX', 'EXTREME', 'FORMULA', 'GENE', 'ZENITH', 'MEG', 'MPG', 'MAG', 'PRO',
    'GODLIKE', 'ACE', 'UNIFY', 'CARBON', 'EDGE', 'TOMAHAWK', 'MORTAR', 'BAZOOKA',
    'TORPEDO', 'AORUS', 'VISION', 'AERO', 'ELITE', 'MASTER', 'XTREME', 'PRO',
    'ULTRA', 'UD', 'DS3H', 'D3SH', 'TAICHI', 'STEEL LEGEND', 'PHANTOM', 'VELOCITA',
    'PRO4', 'PRO', 'ANNIVERSARY', 'AQUA', 'LEGEND', 'PG', 'LIVEMIXER', 'STEEL',
    'CORE', 'ULTRA', 'PLUS'
  ],
  ram: [
    'VENGEANCE', 'DOMINATOR', 'LPX', 'ELITE', 'PLATINUM', 'PRO', 'RGB', 'RT',
    'RS', 'TRIDENT', 'RIPJAWS', 'AEGIS', 'FLARE', 'NEO', 'ROYAL', 'ELITE',
    'FURY', 'RENEGADE', 'BEAST', 'HYPERX', 'BALLISTIX', 'PRO', 'CORE', 'ULTRA',
    'PLUS'
  ],
  storage: [
    'BLACK', 'BLUE', 'RED', 'GOLD', 'PURPLE', 'SN', 'EVO', 'PRO', 'QVO', 'PLUS',
    '870', '970', '980', '990', 'CORE', 'ULTRA', 'PLUS'
  ],
  case: [
    'LANCOOL', 'DYNAMIC', 'VISION', 'O11', 'PRISM', 'FLOW', 'H5', 'H6', 'H7',
    'H9', 'ELITE', 'MASTERBOX', 'ASTRAL', 'VALOR', 'CORE', 'STEEL'
  ],
  cooling: [
    'PRISM', 'HYDROSHIFT', 'GALAHAD', 'ELITE', 'FLOW', 'KRAKEN', 'MASTERLIQUID',
    'HYPER', 'HALO', 'CORE', 'ILLUSION', 'FLUX', 'ASTRAL', 'STEEL', 'LEGEND'
  ],
  fan: [
    'PRISM', 'HALO', 'CORE', 'RGB'
  ],
  psu: [
    'AORUS', 'TUF', 'ROG', 'BLUE', 'RED', 'GOLD', 'BLACK'
  ]
};

export const SERIES_TOKENS = Array.from(
  new Set(Object.values(SERIES_TOKENS_BY_CATEGORY).flat())
).sort((a, b) => b.length - a.length);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MatchScore {
  total: number;       // 0–100
  brandMatch: boolean;
  specMatch: number;   // 0-1 (ratio of DNA tokens)
  seriesMatch: boolean;
  rejectionReason?: string;
}

export interface CatalogComponent {
  id: number;
  name: string;
  brand: string | null;
  category: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extracts series tokens from a name, optionally restricted to a specific category.
 */
export function extractSeries(name: string, category?: string): string[] {
  const n = ` ${normalize(name)} `;
  const found: string[] = [];
  
  let tokens = SERIES_TOKENS;
  if (category) {
    if (SERIES_TOKENS_BY_CATEGORY[category]) {
      tokens = [...SERIES_TOKENS_BY_CATEGORY[category]].sort((a, b) => b.length - a.length);
    } else {
      tokens = []; // Explicit category with no defined tokens has NO series tokens
    }
  }
  
  for (const token of tokens) {
    const t = normalize(token);
    if (n.includes(` ${t} `)) {
      found.push(t);
    }
  }
  return [...new Set(found)];
}

// ── Core Engine ───────────────────────────────────────────────────────────────

interface PrecomputedCatalogComponent {
  fullName: string;
  brand: string | null;
  dnaTokens: string[];
  series: string[];
  seriesSet: Set<string>;
}

const catalogCache = new Map<number, PrecomputedCatalogComponent>();

/**
 * Calculates a strict confidence score between a scraped name and a catalog component.
 * 
 * Rules:
 * - Brand Match: +20%
 * - Spec (DNA) Match: +40% (if all tokens match)
 * - Series Match: +40%
 * - Exclusion: Rejects if series mismatch (one has ROG, other has PRIME).
 */
export function calculateStrictScore(
  scrapedName: string,
  catalogComponent: CatalogComponent,
  pBrand?: string | null,
  sNorm?: string,
  pSeries?: string[],
  pSeriesSet?: Set<string>
): MatchScore {
  let cached = catalogCache.get(catalogComponent.id);
  if (!cached) {
    const catalogFullName = catalogComponent.brand 
      ? `${catalogComponent.brand} ${catalogComponent.name}` 
      : catalogComponent.name;
    const s = extractSeries(catalogFullName, catalogComponent.category);
    cached = {
      fullName: catalogFullName,
      brand: extractBrand(catalogFullName),
      dnaTokens: extractDna(catalogFullName, catalogComponent.category),
      series: s,
      seriesSet: new Set(s)
    };
    catalogCache.set(catalogComponent.id, cached);
  }

  if (pBrand === undefined) pBrand = extractBrand(scrapedName);
  if (sNorm === undefined) sNorm = normalize(scrapedName);
  if (pSeries === undefined) pSeries = extractSeries(scrapedName, catalogComponent.category);
  if (pSeriesSet === undefined) pSeriesSet = new Set(pSeries);

  const res: MatchScore = {
    total: 0,
    brandMatch: false,
    specMatch: 0,
    seriesMatch: false
  };

  // 1. Brand Match (20%)
  const cBrand = cached.brand;
  
  if (pBrand && cBrand) {
    if (pBrand.toLowerCase() === cBrand.toLowerCase()) {
      res.brandMatch = true;
      res.total += 20;
    } else {
      const GPU_CHIP_BRANDS = new Set(['nvidia', 'amd', 'intel']);
      const isGpuWithChipBrand = catalogComponent.category === 'gpu' && cBrand && GPU_CHIP_BRANDS.has(cBrand.toLowerCase());
      
      if (!isGpuWithChipBrand) {
        res.rejectionReason = `Brand mismatch: ${pBrand} vs ${cBrand}`;
        return res;
      }
      // GPU Exception: grant full brand points if catalog is chip manufacturer
      res.brandMatch = true;
      res.total += 20;
    }
  } else if (!pBrand && !cBrand) {
    res.brandMatch = true;
    res.total += 20; // Full points if both generic
  } else {
    // One has brand, other doesn't. Penalize but don't reject yet.
    res.total += 10;
  }

  // 2. Spec (DNA) Match (40%)
  const dnaTokens = cached.dnaTokens;
  if (dnaTokens.length === 0) {
    res.rejectionReason = 'No DNA tokens found for catalog component';
    return res;
  }

  let matchedDna = 0;
  for (const token of dnaTokens) {
    const regex = tokenToRegex(token);
    if (regex.test(sNorm!)) matchedDna++;
  }

  res.specMatch = matchedDna / dnaTokens.length;
  if (res.specMatch >= 1.0) {
    res.total += 40;
  } else if (res.specMatch > 0) {
    // Partial spec match is heavily penalized in strict mode
    res.total += (res.specMatch * 20); // max 20% for partial
  }

  // 3. Series / Sub-tier Match (40%) - The Exclusion Engine
  const cSeriesSet = cached.seriesSet;

  // Negative Constraint: If offer has a sub-tier but catalog doesn't -> REJECT
  const offerHasExtraSeries = pSeries!.some(s => !cSeriesSet.has(s));
  if (offerHasExtraSeries) {
    res.rejectionReason = `Offer contains extra series tokens: ${pSeries!.filter(s => !cSeriesSet.has(s)).join(', ')}`;
    return res;
  }

  // Negative Constraint: If catalog has a sub-tier but offer doesn't -> REJECT
  const catalogHasExtraSeries = cached.series.some(s => !pSeriesSet!.has(s));
  if (catalogHasExtraSeries) {
    res.rejectionReason = `Offer missing catalog series tokens: ${cached.series.filter(s => !pSeriesSet!.has(s)).join(', ')}`;
    return res;
  }

  // If we reach here, series match exactly (or both are empty)
  res.seriesMatch = true;
  res.total += 40;

  return res;
}

/**
 * Finds the best match while enforcing strictness and ambiguity rejection.
 */
export function findStrictMatch(
  scrapedName: string,
  components: CatalogComponent[],
  threshold = 95
): { componentId: number; score: number } | null {
  const matches: { componentId: number; score: number }[] = [];

  if (components.length === 0) return null;

  const pBrand = extractBrand(scrapedName);
  const sNorm = normalize(scrapedName);
  
  // Cache pSeries by category in case components list contains mixed categories
  const pSeriesCache = new Map<string, string[]>();
  const pSeriesSetCache = new Map<string, Set<string>>();

  for (const component of components) {
    let pSeries = pSeriesCache.get(component.category);
    let pSeriesSet = pSeriesSetCache.get(component.category);
    if (!pSeries) {
      pSeries = extractSeries(scrapedName, component.category);
      pSeriesSet = new Set(pSeries);
      pSeriesCache.set(component.category, pSeries);
      pSeriesSetCache.set(component.category, pSeriesSet);
    }

    const score = calculateStrictScore(scrapedName, component, pBrand, sNorm, pSeries, pSeriesSet);
    if (score.total >= threshold) {
      matches.push({ componentId: component.id, score: score.total });
    }
  }

  if (matches.length === 0) return null;
  
  // Ambiguity Rejection: If multiple masters match, fail auto-link.
  if (matches.length > 1) {
    // Sort by score and then by name length (specificity)
    matches.sort((a, b) => b.score - a.score);
    if (matches[0].score === matches[1].score) {
       return null; // Truly ambiguous
    }
  }

  return matches[0];
}
