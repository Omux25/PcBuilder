/**
 * suggestionEngine.ts — Pure function module for catalog expansion suggestions.
 *
 * Analyzes a scraped product name and returns:
 *   - category suggestion (using existing DNA matcher + keyword scorer fallback)
 *   - canonical name (stripped of color/language/noise tokens)
 *   - brand (extracted from known brand list)
 *   - existing component match (if catalog already has this product)
 *   - specs hint (pre-filled fields for the admin creation form)
 *
 * NO database access in this file — all functions are pure.
 * The DB layer (suggestionPreprocessor.ts) calls these functions and persists results.
 *
 * Requirements: 1.1–1.7, 2.1–2.5, 3.1–3.7
 */

import { findBestMatch, type CatalogComponent } from '../utils/componentMatcher.js';
import { matchesRule, type KeywordRule } from './keywordRulesService.js';
import {
    extractBrand,
    extractCpuSpecs,
    extractGpuSpecs,
    extractRamSpecs,
    extractStorageSpecs,
    extractMotherboardSpecs,
    extractPsuSpecs,
    extractCoolingSpecs,
    extractCaseSpecs,
    decodeHtml,
} from '@shared/component-utils';
import { SCRAPER_CONFIG } from '@shared/scraper-config';
import type { ComponentCategory } from '@shared/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SuggestionCategory = ComponentCategory | null;

export interface Suggestion {
    category: SuggestionCategory;
    confidence: 'high' | 'medium' | 'low';
    canonical_name: string;
    brand: string | null;
    existing_component_id: number | null;
    specs_hint: Record<string, unknown>;
}

// ── Token lists ───────────────────────────────────────────────────────────────

const COLOR_TOKENS = [
    'noir', 'blanc', 'black', 'white', 'blanche', 'noire',
    'rouge', 'red', 'blue', 'bleu', 'silver', 'argent', 'gold', 'or',
    'pink', 'rose', 'green', 'vert', 'purple', 'violet', 'grey', 'gray', 'gris',
];

const NOISE_TOKENS = [
    'kit', 'bundle', 'pack', 'combo', 'oem', 'retail', 'box',
    'edition', 'version',
];

// ── Canonical name derivation ─────────────────────────────────────────────────

/**
 * Derives a canonical name from a scraped product name by:
 * 1. Stripping the brand prefix
 * 2. Stripping color/language tokens (whole-word, case-insensitive)
 * 3. Stripping noise tokens (whole-word, case-insensitive)
 * 4. Normalizing whitespace
 *
 * Pure function — no side effects, no DB access.
 * Requirements: 3.1–3.7
 */
export function deriveCanonicalName(scrapedName: string, brand: string | null): string {
    let name = scrapedName.trim();

    // Strip brand prefix (case-insensitive)
    if (brand) {
        const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        name = name.replace(new RegExp(`^${escaped}\\s*`, 'i'), '').trim();
    }

    // Strip color and noise tokens (whole-word, case-insensitive)
    const allTokens = [...COLOR_TOKENS, ...NOISE_TOKENS];
    for (const token of allTokens) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        name = name.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
    }

    // Normalize whitespace
    name = name.replace(/\s+/g, ' ').trim();

    // Fallback: if stripping left nothing, return original minus brand
    if (!name) {
        let fallback = scrapedName.trim();
        if (brand) {
            const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            fallback = fallback.replace(new RegExp(`^${escaped}\\s*`, 'i'), '').trim();
        }
        return fallback || scrapedName;
    }

    return name;
}

// ── Brand extraction ──────────────────────────────────────────────────────────

// Extended brand list covering all brands seen in the Moroccan retailer queue
const KNOWN_BRANDS = [
    'ASUS', 'MSI', 'Gigabyte', 'ASRock', 'EVGA', 'Biostar',
    'AMD', 'Intel', 'NVIDIA',
    'Corsair', 'G.Skill', 'Kingston', 'Crucial', 'TeamGroup', 'Lexar', 'ADATA',
    'Samsung', 'WD', 'Seagate', 'Sabrent', 'Silicon Power', 'Toshiba',
    'Seasonic', 'be quiet!', 'Cooler Master', 'Thermaltake', 'Antec', 'DeepCool',
    'Fractal', 'NZXT', 'Lian Li', 'Phanteks', 'Aerocool', 'Silverstone',
    'Noctua', 'Arctic', 'Thermalright', 'Scythe', 'ID-Cooling', 'APNX',
    'Arktek', 'Inno3D', 'Palit', 'Zotac', 'Sapphire', 'PowerColor', 'XFX',
    'PNY', 'Gainward', 'Colorful', 'Galax', 'KFA2',
    'Acer', 'HP', 'Patriot', 'Klevv', 'Geil', 'Mushkin',
    'FSP', 'Super Flower', 'XPG', 'Cougar', 'Chieftec', 'LC Power',
    '1stPlayer', 'Kolink', 'Sharkoon', 'BitFenix',
    'Mars Gaming', 'Thermal Grizzly', 'Hybrok', 'XtrmLab', 'OCPC', 'Connect',
    'Abkoncore', 'Anima', 'Cougar', 'Aorus',
];

/**
 * Extracts the brand from a scraped product name using the known brand list.
 * Falls back to the existing extractBrand() from component-utils.
 * Pure function.
 */
export function extractBrandFromName(scrapedName: string): string | null {
    const n = scrapedName.trim();

    // Check multi-word brands first (e.g. "be quiet!", "Mars Gaming", "Thermal Grizzly")
    const sorted = [...KNOWN_BRANDS].sort((a, b) => b.length - a.length);
    for (const brand of sorted) {
        if (n.toLowerCase().startsWith(brand.toLowerCase())) {
            return brand;
        }
    }

    // Fall back to shared extractBrand
    const fallback = extractBrand(n);
    // Only return if it looks like a real brand (not just the first word of a generic name)
    if (fallback && fallback.length > 1) return fallback;

    return null;
}

// ── Keyword scorer ────────────────────────────────────────────────────────────

const KEYWORD_SETS: Record<string, string[]> = {
    cooling: [
        // AIO keywords
        'aio', 'liquid', 'radiator', 'kraken', 'h100', 'h115', 'h150', 'h170',
        'le720', 'le520', 'le240', 'lq360', 'lq240', 'mystique', 'galahad',
        'coreliquid', 'mirage', 'freezer ii', 'pure loop', 'lt520', 'lt720',
        'rl360', 'strix lc', 'rog lc', 'refroidisseur liquide', 'watercooling',
        'corefrozr', 'castle', 'castle 240', 'castle 360', 'aqua',
        'ml one', 'ml ultra', 'ml lcd', 'ml-one', 'ml-lcd',
        'sg 240ml', 'sg 360ml', '240ml argb', '360ml argb',
        // Air cooler keywords
        'ventirad', 'cooler', 'refroidissement', 'nh-d', 'nh-u', 'ak400', 'ak500',
        'ak620', 'ak700', 'assassin', 'dark rock', 'shadow rock', 'gammaxx',
        'hyper 212', 'arctic alpine', 'arctic freezer', 'ag200', 'ag300', 'ag400',
        'aircooler', 'air cooler', 'cpu cooler', 'cpu fan',
        'a30', 'a400 rgb', 'cylon 3',
    ],
    fan: [
        '120mm', '140mm', '200mm', 'pwm fan', 'case fan', 'chassis fan',
        'f120', 'f140', 'll120', 'ql120', 'fd12', 'fd14', 'fk120',
        'light wings', 'pure wings', 'riing', 'toughfan', 'duo 12',
        'core plus', 'arctic flow', 'ventilateur', 'fan pack', 'triple pack',
        'dual pack', 'twin pack', 'argb fan', 'rgb fan',
        'fp1-r', 'mcpupro', 'mcpu66', 'vortex fcb',
        'sickleflow', 'sicklefan',
    ],
    thermal_paste: [
        'thermal', 'paste', 'grizzly', 'kryonaut', 'conductonaut', 'hydronaut',
        'aeronaut', 'duronaut', 'mx-4', 'mx-6', 'mx-7', 'carbonaut', 'kryosheet',
        'pate thermique', 'pâte thermique', 'thermal compound', 'thermal grease',
        'contact frame', 'sealing frame', 'cleaning wipes', 'mx cleaner',
    ],
    case: [
        // Generic case words
        'tower', 'boitier', 'boîtier', 'tempered glass', 'tg argb',
        'mid tower', 'full tower', 'mini itx', 'micro atx',
        // NZXT cases
        'h510', 'h710', 'h9', 'h6', 'h5', 'h7', 'h210', 'h400', 'h440',
        'nzxt h', 'h510i', 'h710i',
        // Lian Li
        'o11', 'lancool', 'pc-o11', 'lian li o',
        // Fractal
        'torrent', 'north', 'define', 'meshify', 'pop air', 'pop mini',
        // be quiet!
        'silent base', 'pure base',
        // DeepCool
        'matrexx', 'ch510', 'ch560', 'cc560', 'cg580', 'cg530',
        // XTRMLAB
        'xt-1', 'xt-2',
        // ASUS
        'a21', 'a31', 'ap201', 'ap202', 'gt301', 'gt302', 'proart pa',
        // MSI
        'pano', 'forge', 'gungnir', 'sekira', 'mpg gungnir', 'mag pano',
        // Corsair cases (numbered series)
        'corsair 2500', 'corsair 3000', 'corsair 3500', 'corsair 4000', 'corsair 5000', 'corsair 6500',
        'cx300 argb', 'cg580', 'cc560', '3500x', '6500d', '4000d', '5000d',
        // Aerocool
        'aero one', 'cylon', 'shard', 'bolt', 'scape', 'tor ',
        // Mars Gaming
        'mc500', 'mc51', 'mca', 'mcmesh', 'mcorb', 'mc61',
        // Cooler Master
        'masterbox', 'mastercase', 'silencio', 'haf', 'td500',
        'cm 6500x', '6500x', 'cm 6600x',
        // Thermaltake
        'view 31', 'view 51', 'level 20', 'core p',
        // Phanteks
        'eclipse', 'enthoo', 'evolv',
        // Cougar
        'cougar mx', 'cougar mg', 'cougar qbx',
        // APNX
        'apnx v1', 'apnx c1',
        // Antec
        'antec c3', 'antec vcx', 'antec vx',
        // Abkoncore
        'tengri',
        // Hybrok
        'hybrok shadow',
        // 1stPlayer
        '1stplayer x',
        // Aorus
        'aorus c300',
    ],
    motherboard: [
        'b450', 'b550', 'b650', 'b760', 'b850', 'b860', 'x570', 'x670',
        'z690', 'z790', 'z890', 'a520', 'a620', 'h610', 'h670', 'h770',
        'h470', 'b460', 'b560', 'z590', 'z490',
        'prime b', 'prime x', 'prime z', 'prime h', 'rog strix b', 'rog strix x',
        'tuf gaming b', 'tuf gaming x', 'tuf gaming z', 'meg x', 'msi pro z',
        'msi mag b', 'msi mag x', 'aorus elite', 'aorus master', 'aorus pro',
        'tomahawk', 'mortar', 'unify', 'phantom gaming', 'steel legend',
        'carte mère', 'motherboard', 'mpg b650i', 'b650i edge',
        'asrock b', 'asrock x', 'asrock a', 'asrock h',
    ],
    storage: [
        'nvme', 'ssd', 'hdd', 'm.2', 'pcie', 'sata', 'barracuda', 'firecuda',
        'sn850', 'sn770', 'nm790', 'ns100', '870 evo', '980 pro', '990 pro',
        'nv2', 'a400', 'p3 nvme', 'p5 nvme', 'disque dur', 'disque ssd',
        'wd blue', 'wd black', 'wd red', 'ironwolf', 'skyhawk',
        'su650', 'sx6000', 'gammix', 'lame gammix',
        'kingston a400', 'kingston a2000', 'kingston nv',
        'lexar ns100', 'lexar sl200',
        'ocpc mfl', 'ocpc xtl',
        'pny cs900', 'crucial p2', 'crucial p3', 'crucial e100',
        'toshiba p300', 'wd caviar',
        'teamgroup gx2', 't-force delta rgb 1tb',
        'verbatim', 'usb 3.0 2tb', 'usb 3.0 4tb',
    ],
    ram: [
        'ddr4', 'ddr5', 'mhz', 'vengeance', 'ripjaws', 'trident',
        'fury beast', 't-force', 'ares ddr', 'cl16', 'cl30', 'cl36',
        'dimm', 'mémoire', 'memory', '3200mhz', '3600mhz', '5600mhz', '6000mhz',
        'vengeance rgb pro', 'vengeance rgb', 'vengeance lpx',
        'teamgroup delta', 'aorus rgb',
        'pc portable elite',
    ],
    psu: [
        'watt', '850w', '1000w', '750w', '650w', '550w', '450w', '300w',
        'modular', '80+', 'gold', 'platinum', 'titanium', 'bronze',
        'rm850', 'rm1000', 'hx1000', 'focus gx', 'straight power', 'pure power',
        'toughpower', 'alimentation', 'power supply', 'atx 3.0', 'atx 3.1',
        'pq850', 'pq1000', 'mag a850', 'mag a1000',
        'antec csk', 'antec ne1000', 'antec ne1300',
        'aero bronze', 'aero bronze 650', 'aero bronze 750',
        'anima apiii',
    ],
    gpu: [
        'rtx', 'gtx', 'radeon', 'rx 6', 'rx 7', 'rx 9', 'geforce',
        'vram', 'gddr6', 'graphics', 'carte graphique', 'gpu',
        'arc b580', 'arc b570', 'arc a770', 'arc a750',
        'rx550', 'arktek rx',
    ],
    cpu: [
        'ryzen', 'core i', 'core ultra', 'threadripper', 'socket am',
        'lga1700', 'lga1851', 'ghz', 'processeur', 'processor',
        'i3-', 'i5-', 'i7-', 'i9-', 'athlon', 'pentium', 'celeron',
        'i7-9700',
    ],
};

/**
 * Scores a scraped name against keyword sets for all categories.
 * Returns the best-matching category and confidence level.
 * Pure function — no DB access.
 * Requirements: 2.1–2.5
 */
function keywordScore(scrapedName: string): { category: SuggestionCategory; confidence: 'medium' | 'low' } {
    const n = scrapedName.toLowerCase();
    const scores: Record<string, number> = {};

    for (const [cat, keywords] of Object.entries(KEYWORD_SETS)) {
        let score = 0;
        for (const kw of keywords) {
            if (n.includes(kw)) score++;
        }
        scores[cat] = score;
    }

    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topCat, topScore] = entries[0];
    const [, secondScore] = entries[1] ?? ['', 0];

    if (topScore === 0) {
        return { category: null, confidence: 'low' };
    }

    if (topScore > secondScore) {
        return { category: topCat as ComponentCategory, confidence: 'medium' };
    }

    return { category: null, confidence: 'low' };
}

// ── Specs hint builder ────────────────────────────────────────────────────────

/**
 * Builds a specs hint object for pre-filling the admin creation form.
 * Uses the existing spec extractors from @shared/component-utils.
 * Pure function.
 */
function buildSpecsHint(scrapedName: string, category: SuggestionCategory): Record<string, unknown> {
    if (!category) return {};

    try {
        switch (category) {
            case 'cpu': {
                const specs = extractCpuSpecs(scrapedName);
                return specs ? { socket: specs.socket, tdp: specs.tdp } : {};
            }
            case 'gpu': {
                const specs = extractGpuSpecs(scrapedName);
                return { length_mm: specs.length_mm, tdp: specs.tdp };
            }
            case 'ram': {
                const specs = extractRamSpecs(scrapedName);
                return specs ? { ram_type: specs.ram_type, frequency_mhz: specs.frequency_mhz } : {};
            }
            case 'storage': {
                const specs = extractStorageSpecs(scrapedName);
                return specs ? { interface_type: specs.interface_type } : {};
            }
            case 'motherboard': {
                const specs = extractMotherboardSpecs(scrapedName);
                return specs ? {
                    socket: specs.socket,
                    supported_ram_types: specs.supported_ram_types,
                    max_ram_frequency: specs.max_ram_frequency,
                } : {};
            }
            case 'psu': {
                const specs = extractPsuSpecs(scrapedName);
                return specs ? { wattage: specs.wattage } : {};
            }
            case 'cooling': {
                const specs = extractCoolingSpecs(scrapedName);
                return specs ? { tdp: specs.tdp } : {};
            }
            case 'case': {
                const specs = extractCaseSpecs(scrapedName);
                return { max_gpu_length_mm: specs.max_gpu_length_mm };
            }
            case 'fan': {
                // Extract size from name (e.g. "120mm", "140mm")
                const sizeMatch = scrapedName.match(/\b(80|92|120|140|200)\s*mm\b/i);
                const size_mm = sizeMatch ? parseInt(sizeMatch[1]) : 120;
                const rgb = /\b(rgb|argb)\b/i.test(scrapedName);
                // Detect pack size from "Triple Pack" / "Dual Pack" / "Twin Pack"
                const tripleMatch = /\b(triple|3.?pack|3x)\b/i.test(scrapedName);
                const dualMatch = /\b(dual|twin|2.?pack|2x)\b/i.test(scrapedName);
                const pack_size = tripleMatch ? 3 : dualMatch ? 2 : 1;
                return { size_mm, rgb, pack_size };
            }
            case 'thermal_paste': {
                // Extract weight from name (e.g. "4 grammes", "1 gramme", "8g")
                const weightMatch = scrapedName.match(/\b(\d+(?:\.\d+)?)\s*(?:grammes?|g)\b/i);
                const weight_grams = weightMatch ? parseFloat(weightMatch[1]) : null;
                // Detect type
                const isLiquidMetal = /\b(conductonaut|liquid metal)\b/i.test(scrapedName);
                const isPad = /\b(carbonaut|kryosheet|pad)\b/i.test(scrapedName);
                const paste_type = isLiquidMetal ? 'liquid_metal' : isPad ? 'pad' : 'paste';
                return { weight_grams, paste_type };
            }
            default:
                return {};
        }
    } catch {
        return {};
    }
}

// ── Main suggestion function ──────────────────────────────────────────────────

/**
 * Generates a suggestion for a single scraped product name.
 *
 * Algorithm:
 * 1. Extract brand and derive canonical name
 * 2. Try DNA match at PERFECT_THRESHOLD → confidence: "high", existing_component_id set
 * 3. Try DNA match at PARTIAL_THRESHOLD → confidence: "medium", existing_component_id set
 * 4. Fall through to keyword scorer → confidence: "medium" or "low", no existing match
 * 5. Build specs hint from category
 *
 * Pure function — same inputs always produce same outputs.
 * Requirements: 1.1–1.7, 2.1–2.5, 3.1–3.7
 */
export function suggestForListing(
    scrapedName: string,
    catalog: CatalogComponent[],
    adminRules?: KeywordRule[],
): Suggestion {
    // Decode HTML entities first (retailers store names with &#8211;, &Prime;, etc.)
    const name = decodeHtml(scrapedName);
    const brand = extractBrandFromName(name);
    const canonical_name = deriveCanonicalName(name, brand);

    // Step 2: DNA match at perfect threshold (use decoded name)
    const perfectMatch = findBestMatch(name, catalog, SCRAPER_CONFIG.PERFECT_THRESHOLD);
    if (perfectMatch) {
        const matched = catalog.find(c => c.id === perfectMatch.componentId);
        const category = (matched?.category ?? null) as SuggestionCategory;
        return {
            category,
            confidence: 'high',
            canonical_name,
            brand,
            existing_component_id: perfectMatch.componentId,
            specs_hint: buildSpecsHint(name, category),
        };
    }

    // Step 3: DNA match at partial threshold
    const partialMatch = findBestMatch(name, catalog, SCRAPER_CONFIG.PARTIAL_THRESHOLD);
    if (partialMatch) {
        const matched = catalog.find(c => c.id === partialMatch.componentId);
        const category = (matched?.category ?? null) as SuggestionCategory;
        return {
            category,
            confidence: 'medium',
            canonical_name,
            brand,
            existing_component_id: partialMatch.componentId,
            specs_hint: buildSpecsHint(name, category),
        };
    }

    // Step 4: Admin rules check — before hardcoded keyword scorer
    // Load admin rules once per batch (passed in from preprocessor).
    // If all matching rules agree on a single category → use it with medium confidence.
    // If rules disagree → fall through to keyword scorer.
    if (adminRules && adminRules.length > 0) {
        const matchingRules = adminRules.filter(r => matchesRule(r, name));
        if (matchingRules.length > 0) {
            const categories = new Set(matchingRules.map(r => r.category));
            if (categories.size === 1) {
                const category = matchingRules[0].category as SuggestionCategory;
                return {
                    category,
                    confidence: 'medium',
                    canonical_name,
                    brand,
                    existing_component_id: null,
                    specs_hint: buildSpecsHint(name, category),
                };
            }
            // Multiple rules disagree — fall through to keyword scorer
        }
    }

    // Step 5: Keyword scorer fallback (use decoded name)
    const { category: kwCategory, confidence: kwConfidence } = keywordScore(name);

    return {
        category: kwCategory,
        confidence: kwConfidence,
        canonical_name,
        brand,
        existing_component_id: null,
        specs_hint: buildSpecsHint(name, kwCategory),
    };
}

// ── Batch processor ───────────────────────────────────────────────────────────

/**
 * Processes a batch of listings and returns a Map of id → Suggestion.
 * Loads the catalog once and reuses it for all listings.
 * Pure function — same inputs always produce same outputs.
 * Requirements: 4.5
 */
export function processBatch(
    listings: Array<{ id: number; scraped_name: string }>,
    catalog: CatalogComponent[],
    adminRules?: KeywordRule[],
): Map<number, Suggestion> {
    const results = new Map<number, Suggestion>();
    for (const listing of listings) {
        results.set(listing.id, suggestForListing(listing.scraped_name, catalog, adminRules));
    }
    return results;
}
