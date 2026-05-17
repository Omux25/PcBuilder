/**
 * brand-authority.ts — Brand Authority Engine
 *
 * Solves three permanent data quality problems:
 *
 * 1. WRONG CATEGORY: A product scraped from a CPU page that is actually a GPU
 *    (e.g. SetupGame "PC Gamer" bundles, or a retailer miscategorizing items).
 *    → If a brand is known to only make GPUs, it cannot be a CPU.
 *
 * 2. WRONG BRAND: A product listed under the wrong brand by a retailer
 *    (e.g. HyperX RAM listed under "Cooler Master" because they share shelf space).
 *    → Brand aliases remap to the canonical brand.
 *
 * 3. BUNDLE DETECTION: A product name containing both CPU and GPU DNA
 *    (e.g. "PC Gamer Ryzen 5 5600 + RTX 4070") → dismiss as bundle.
 *
 * Design principles:
 * - Pure functions, no DB calls, no side effects
 * - Called in aggregator Phase A before category resolution
 * - Returns null to dismiss, or { brand, category } to override
 */

import type { Category } from './component-utils.js';

// ── Brand → Allowed Categories ────────────────────────────────────────────────
//
// Maps a canonical brand name to the set of categories it can legitimately
// produce. If a scraped item's inferred brand is in this map but its inferred
// category is NOT in the allowed set, the category is wrong.
//
// Rules:
// - Only include brands where we are CERTAIN about their product lines
// - Err on the side of inclusion (missing a brand = no validation = safe)
// - GPU chip brands (AMD, NVIDIA, Intel) are excluded because they also make CPUs/motherboards

const BRAND_CATEGORIES: Record<string, Set<Category>> = {
    // ── CPU-only brands ───────────────────────────────────────────────────────
    // (none — AMD/Intel also make GPUs/motherboards)

    // ── GPU AIB partners (only make GPUs) ────────────────────────────────────
    'Sapphire': new Set(['gpu']),
    'PowerColor': new Set(['gpu']),
    'XFX': new Set(['gpu']),
    'Gainward': new Set(['gpu']),
    'Palit': new Set(['gpu']),
    'Inno3D': new Set(['gpu']),
    'KFA2': new Set(['gpu']),
    'Galax': new Set(['gpu']),
    'EVGA': new Set(['gpu', 'psu']),
    'Colorful': new Set(['gpu']),
    'MAXSUN': new Set(['gpu']),
    'OCPC': new Set(['gpu', 'ram', 'storage']),

    // ── RAM-only brands ───────────────────────────────────────────────────────
    'G.Skill': new Set(['ram']),
    'Corsair': new Set(['ram', 'psu', 'cooling', 'case', 'fan', 'storage']),
    'Kingston': new Set(['ram', 'storage']),
    'Crucial': new Set(['ram', 'storage']),
    'Lexar': new Set(['ram', 'storage']),
    'TeamGroup': new Set(['ram', 'storage']),
    'Team Group': new Set(['ram', 'storage']),
    'Patriot': new Set(['ram', 'storage']),
    'Klevv': new Set(['ram', 'storage']),
    'Geil': new Set(['ram']),
    'Mushkin': new Set(['ram', 'storage']),
    'Apacer': new Set(['ram', 'storage']),
    'XPG': new Set(['ram', 'storage', 'psu', 'cooling']),
    'TwinMOS': new Set(['ram', 'storage']),
    'Innovation IT': new Set(['ram', 'storage']),

    // ── Storage-only brands ───────────────────────────────────────────────────
    'Seagate': new Set(['storage']),
    'Toshiba': new Set(['storage']),
    'WD': new Set(['storage']),
    'Western Digital': new Set(['storage']),
    'Samsung': new Set(['storage', 'ram']),
    'HIKSEMI': new Set(['storage']),
    'FANXIANG': new Set(['storage']),
    'Sabrent': new Set(['storage']),
    'Silicon Power': new Set(['storage', 'ram']),
    'Verbatim': new Set(['storage']),
    'Netac': new Set(['storage', 'ram']),

    // ── PSU-only brands ───────────────────────────────────────────────────────
    'Seasonic': new Set(['psu']),
    'Super Flower': new Set(['psu']),
    'FSP': new Set(['psu']),
    'Chieftec': new Set(['psu']),
    'LC Power': new Set(['psu']),
    'Enermax': new Set(['psu', 'cooling']),
    'Silverstone': new Set(['psu', 'case', 'cooling']),

    // ── Cooling-only brands ───────────────────────────────────────────────────
    'Noctua': new Set(['cooling', 'fan']),
    'Arctic': new Set(['cooling', 'fan', 'thermal_paste']),
    'Thermalright': new Set(['cooling', 'fan', 'thermal_paste']),
    'Scythe': new Set(['cooling', 'fan']),
    'ID-Cooling': new Set(['cooling', 'fan']),
    'Thermal': new Set(['thermal_paste']),  // Thermal Grizzly

    // ── Case-only brands ─────────────────────────────────────────────────────
    'Hyte': new Set(['case']),
    'Fractal': new Set(['case', 'psu']),
    'NZXT': new Set(['case', 'psu', 'cooling']),
    'Phanteks': new Set(['case', 'psu', 'cooling']),
    'Lian Li': new Set(['case', 'psu', 'cooling', 'fan']),
    'Montech': new Set(['case', 'psu', 'fan']),
    'Kolink': new Set(['case', 'psu']),
    'Sharkoon': new Set(['case', 'psu', 'cooling']),
    'BitFenix': new Set(['case']),
    'Mars Gaming': new Set(['case', 'fan', 'cooling', 'psu']),
    'XTRMLAB': new Set(['case', 'cooling', 'fan', 'fan_controller']),
    'XTMLAB': new Set(['case', 'cooling', 'fan', 'fan_controller']),
    'HAVN': new Set(['case']),
    'Aerocool': new Set(['case', 'psu', 'cooling', 'fan']),
    'Antec': new Set(['case', 'psu', 'cooling', 'fan']),
    'Cougar': new Set(['case', 'psu', 'cooling', 'fan']),
    'Xigmatek': new Set(['case', 'cooling', 'fan']),
    'APNX': new Set(['case', 'cooling', 'fan']),
    'Abkoncore': new Set(['case', 'cooling', 'fan']),
    'Hybrok': new Set(['case', 'cooling', 'psu', 'fan']),
    'HYBROK': new Set(['case', 'cooling', 'psu', 'fan']),
    'SG': new Set(['case', 'psu', 'cooling', 'fan']),
    'Setup Game': new Set(['case', 'psu', 'cooling', 'fan', 'storage']),
    'SG-WAVE': new Set(['case', 'cooling', 'fan']),
    'SG-LINGS': new Set(['case', 'cooling', 'fan']),
    'Itek': new Set(['case']),
    'Spirit of Gamer': new Set(['case', 'cooling', 'fan']),
    'Raijintek': new Set(['case', 'cooling']),
    'ICELIL': new Set(['case']),
    'M.RED': new Set(['case']),
    'Yeyian': new Set(['case']),
    '1stPlayer': new Set(['case', 'psu']),
    'Connect': new Set(['case', 'cooling', 'psu', 'fan']),
    'Infinity': new Set(['case', 'cooling', 'fan']),
    'Nova': new Set(['case', 'cooling', 'fan']),
};

// ── Brand Aliases (wrong brand → canonical brand) ─────────────────────────────
//
// When a retailer lists a product under the wrong brand, remap it.
// Key: the brand as extracted from the product name
// Value: the canonical brand to use instead
//
// Detection: if extracted brand is X but product name contains strong signals
// of brand Y, use Y.

const BRAND_ALIASES: Record<string, string> = {
    // HyperX was Kingston's gaming brand — some retailers still list it under
    // "Cooler Master" because they share shelf space or catalog sections
    'HyperX': 'Kingston',
    'SG': 'Setup Game',
};

// Products whose name contains these strings should have their brand remapped
// regardless of what extractBrand() returns
const NAME_BRAND_OVERRIDES: Array<{ pattern: RegExp; brand: string }> = [
    { pattern: /\bhyperx\b/i, brand: 'Kingston' },
    { pattern: /\bkryonaut\b/i, brand: 'Thermal' },
    { pattern: /\bconductonaut\b/i, brand: 'Thermal' },
    { pattern: /\bhydronaut\b/i, brand: 'Thermal' },
    { pattern: /\baeronaut\b/i, brand: 'Thermal' },
    { pattern: /\bduronaut\b/i, brand: 'Thermal' },
    { pattern: /\bcarbonaut\b/i, brand: 'Thermal' },
    { pattern: /\bkryosheet\b/i, brand: 'Thermal' },
    { pattern: /\bminus\s*pad\b/i, brand: 'Thermal' },
    { pattern: /\bfatal1ty\b/i, brand: 'ASRock' },
    { pattern: /\basrock\b/i, brand: 'ASRock' },
];

// ── Bundle Detection ──────────────────────────────────────────────────────────
//
// A product name that contains BOTH a CPU model AND a GPU model is a bundle.
// These should be dismissed — they are pre-built PCs, not individual components.

const CPU_SIGNALS = [
    /\bryzen/i,
    /\bcore\s+i[3579]/i,
    /\bcore\s+ultra\s+[579]/i,
    /\bthreadripper\b/i,
    /\bxeon\b/i,
    /\bi[3579]-\d/i,
    /\b[ri][3579]\b/i,
];

const GPU_SIGNALS = [
    /\brtx/i,
    /\bgtx/i,
    /\bradeon/i,
    /\brx\s*\d/i,
    /\bquadro\b/i,
    /\bfirepro\b/i,
    /\bpro\s*(6|5)000\b/i,
    /\bvega\b/i,
    /\biris\b/i,
    /\buhd\s*graphics\b/i,
    /\bgt\s*\d{3}/i,
];

const PSU_SIGNALS = [
    /\b(80\s*plus|80plus|gold|bronze|platinum|titanium)\b/i,
    /\b\d{3,4}\s*w\b/i,
    /\balimentation\b/i,
    /\bpsu\b/i,
];

const CASE_SIGNALS = [
    /\b(boitier|boîtier|chassis|mid-tower|tower|case)\b/i,
    /\b(atx|matx|itx)\s*chassis\b/i,
];

// ── Public API ────────────────────────────────────────────────────────────────

export interface BrandAuthorityResult {
    /** Canonical brand to use (may differ from input) */
    brand: string | null;
    /** Whether this item should be dismissed as a bundle/junk */
    dismiss: boolean;
    /** Reason for dismissal (for logging) */
    dismissReason?: string;
    /** Category override if the inferred category is wrong for this brand */
    categoryOverride?: Category;
}

/**
 * Validates and corrects brand/category for a scraped product.
 *
 * @param productName - Raw scraped product name
 * @param inferredBrand - Brand extracted by extractBrand()
 * @param inferredCategory - Category inferred by inferCategory()
 * @returns Corrected brand, dismissal flag, and optional category override
 */
export function validateBrandAuthority(
    productName: string,
    inferredBrand: string | null,
    inferredCategory: Category | null,
): BrandAuthorityResult {
    const name = productName.trim();

    // ── 1. Bundle detection ───────────────────────────────────────────────────
    // Check if name contains BOTH CPU and GPU signals → it's a pre-built PC bundle.
    // Also dismiss if explicitly identified as a 'build' by the inference engine.
    const hasCpuSignal = CPU_SIGNALS.some(r => r.test(name));
    const hasGpuSignal = GPU_SIGNALS.some(r => r.test(name));
    const hasPsuSignal = PSU_SIGNALS.some(r => r.test(name));
    const hasCaseSignal = CASE_SIGNALS.some(r => r.test(name));

    const isWorkstation = /\b(workstation|station\s*de\s*travail|pc\s*professionnel)\b/i.test(name) && hasCpuSignal;
    
    const isBundleProduct = (hasCpuSignal && hasGpuSignal) || 
                           (hasPsuSignal && hasCaseSignal && name.includes('+')) ||
                           inferredCategory === 'build' || 
                           (inferredCategory as string) === 'bundle' || 
                           isWorkstation;

    if (isBundleProduct) {
        return { 
            brand: inferredBrand, 
            dismiss: true, 
            dismissReason: inferredCategory === 'build' ? 'explicit build detection' : 
                          (inferredCategory as string) === 'bundle' ? 'explicit bundle detection' :
                          (isWorkstation ? 'workstation detection' : 'bundle detection') 
        };
    }

    // ── 2. Name-based brand override ─────────────────────────────────────────
    // Some products have strong brand signals in their name that override
    // whatever extractBrand() returned (e.g. "Cooler Master HyperX Fury" → Kingston)
    let canonicalBrand = inferredBrand;
    for (const { pattern, brand } of NAME_BRAND_OVERRIDES) {
        if (pattern.test(name)) {
            canonicalBrand = brand;
            break;
        }
    }

    // ── 3. Brand alias remapping ──────────────────────────────────────────────
    if (canonicalBrand && BRAND_ALIASES[canonicalBrand]) {
        canonicalBrand = BRAND_ALIASES[canonicalBrand];
    }

    // ── 4. Category validation against brand authority ────────────────────────
    if (canonicalBrand && inferredCategory) {
        const allowedCategories = BRAND_CATEGORIES[canonicalBrand];
        if (allowedCategories && !allowedCategories.has(inferredCategory)) {
            // Brand is known but category is wrong.
            // Try to find the correct category from the brand's allowed set.
            // Use the first allowed category as a hint, but only if it's unambiguous.
            if (allowedCategories.size === 1) {
                const correctCategory = [...allowedCategories][0];
                return {
                    brand: canonicalBrand,
                    dismiss: false,
                    categoryOverride: correctCategory,
                };
            }
            // Multiple allowed categories — can't auto-correct, send to unmatched
            return {
                brand: canonicalBrand,
                dismiss: false,
                // No override — let it go to unmatched where admin can review
            };
        }
    }

    return { brand: canonicalBrand, dismiss: false };
}

/**
 * Quick check: is this product name a PC bundle?
 * Used as a fast pre-filter before full brand validation.
 */
export function isBundle(productName: string): boolean {
    const hasCpu = CPU_SIGNALS.some(r => r.test(productName));
    const hasGpu = GPU_SIGNALS.some(r => r.test(productName));
    return (hasCpu && hasGpu) || productName.toLowerCase().includes('workstation');
}
