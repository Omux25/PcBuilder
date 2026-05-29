/**
 * deepScraper.ts
 *
 * Universal Deep Scraper — fetches a product page and extracts missing specs
 * via category-specific regex/parsing strategies.
 *
 * Used as the absolute last-resort fallback when both the LLM and the knowledge
 * cache have no data for a given component.
 *
 * Architecture: Strategy Pattern
 *   scrapeProductPage(url, category) → dispatches to the correct ExtractionStrategy
 *   for the given category, each with its own targeted regex logic.
 */

import type { ResolvedSpecs } from '@shared/hardware/services/dynamicEnrichment';
import * as cheerio from 'cheerio';
import { logger } from '../engine/utils/logger.js';

// ── HTML Normalizer ───────────────────────────────────────────────────────────

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch a URL and use Cheerio to extract a rich, structured text blob from targeted
 * spec/description selectors, bulleted lists, tables, and body content.
 */
async function fetchCleanedText(url: string): Promise<string | null> {
  // Add random jitter (500ms - 1500ms) to avoid rapid-fire rate limits
  await delay(500 + Math.random() * 1000);

  const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  let origin = '';
  try { origin = new URL(url).origin; } catch {}

  const res = await fetch(url, {
    headers: {
      'User-Agent': randomUA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'fr-MA,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': origin ? `${origin}/` : 'https://www.google.com/',
      'Sec-Ch-Ua': '"Google Chrome";v="124", "Chromium";v="124", "Not-A.Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0'
    },
    signal: AbortSignal.timeout(15_000), // 15s — Moroccan CDNs can be slow
  });

  if (!res.ok) {
    await logger.warn(`[DeepScraper] HTTP ${res.status} for ${url}`);
    return null;
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Strip script, style, SVG, and other noise blobs
  $('script, style, svg, iframe, noscript').remove();

  const textParts: string[] = [];

  // 1. Grab titles
  $('h1, h2, h3').each((_, el) => {
    textParts.push($(el).text());
  });

  // 2. Grab description blocks and technical specifications containers
  $('.description, #tab-description, .product-description, #description, .tech-specs, [id*="description"], [class*="description"], [class*="spec"]').each((_, el) => {
    textParts.push($(el).text());
  });

  // 3. Grab all list items to capture unstructured specifications (e.g., <li>Latence CAS : CL21</li>)
  $('ul > li, ol > li, li').each((_, el) => {
    textParts.push($(el).text());
  });

  // 4. Grab table rows and cells
  $('tr, th, td').each((_, el) => {
    textParts.push($(el).text());
  });

  // 5. Append the entire body text to ensure full coverage
  textParts.push($('body').text());

  // Join parts with newlines and spaces to keep boundaries distinct but searchable
  const combined = textParts
    .map(t => t.trim())
    .filter(Boolean)
    .join(' \n ');

  // Collapse consecutive whitespaces into a single space, but keep it highly readable
  return combined.replace(/\s+/g, ' ').trim();
}

// ── Extraction Strategies ─────────────────────────────────────────────────────

type ExtractionStrategy = (cleaned: string) => ResolvedSpecs | null;

/**
 * CASE strategy — max_gpu_length_mm, max_cpu_cooler_height_mm, form_factors
 */
const caseStrategy: ExtractionStrategy = (cleaned) => {
  let max_cpu_cooler_height_mm: number | null = null;
  let max_gpu_length_mm: number | null = null;
  let form_factors: string[] = [];

  // ── Cooler height ─────────────────────────────────────────────────────────
  const coolerPatterns = [
    /hauteur[^0-9]{0,40}(?:max(?:imale)?[^0-9]{0,20})?(?:ventirad|cpu|processeur|radiateur)[^0-9]{0,20}(\d{2,3})\s*mm/i,
    /(?:cpu\s*)?cooler[^0-9]{0,30}(?:max(?:imum)?[^0-9]{0,10})?(?:height|clearance|hauteur)[^0-9]{0,20}(\d{2,3})\s*mm/i,
    /ventirad[^0-9]{0,30}(\d{2,3})\s*mm/i,
    /max(?:imum)?[^0-9]{0,20}(?:cpu\s*)?(?:cooler|ventirad|radiateur)[^0-9]{0,20}(\d{2,3})\s*mm/i,
    /clearance[^0-9]{0,20}cpu[^0-9]{0,20}(\d{2,3})\s*mm/i,
    /hauteur[^0-9]{0,60}(\d{2,3})\s*mm/i,
  ];

  for (const re of coolerPatterns) {
    const m = cleaned.match(re);
    if (m?.[1]) {
      const v = parseInt(m[1], 10);
      if (v >= 60 && v <= 220) { max_cpu_cooler_height_mm = v; break; }
    }
  }

  // ── GPU clearance ─────────────────────────────────────────────────────────
  const gpuPatterns = [
    /(?:gpu|carte graphique|graphic card)[^0-9]{0,30}(?:max(?:imum)?[^0-9]{0,10})?(?:length|longueur|clearance)[^0-9]{0,20}(\d{3})\s*mm/i,
    /longueur[^0-9]{0,40}(?:max(?:imale)?[^0-9]{0,20})?(?:gpu|carte|graphic)[^0-9]{0,20}(\d{3})\s*mm/i,
    /max(?:imum)?[^0-9]{0,20}(?:gpu|carte graphique)[^0-9]{0,20}(\d{3})\s*mm/i,
    /(?:length|longueur)[^0-9]{0,20}gpu[^0-9]{0,20}(\d{3})\s*mm/i,
    /gpu[^0-9]{0,30}(\d{3})\s*mm/i,
  ];

  for (const re of gpuPatterns) {
    const m = cleaned.match(re);
    if (m?.[1]) {
      const v = parseInt(m[1], 10);
      if (v >= 100 && v <= 600) { max_gpu_length_mm = v; break; }
    }
  }

  // ── Form factors ──────────────────────────────────────────────────────────
  const upper = cleaned.toUpperCase();
  if (/\bE[-\s]?ATX\b/.test(upper) || upper.includes('EATX')) form_factors.push('E-ATX');
  if (/\bATX\b/.test(upper)) {
    if (!form_factors.includes('ATX')) form_factors.push('ATX');
  }
  if (upper.includes('MICRO-ATX') || upper.includes('MICRO ATX') || /\bMATX\b/.test(upper) || /\bM-ATX\b/.test(upper) || /\bMICROATX\b/.test(upper)) {
    form_factors.push('Micro-ATX');
  }
  if (upper.includes('MINI-ITX') || upper.includes('MINI ITX') || /\bMINIITX\b/.test(upper) || (/\bITX\b/.test(upper) && !upper.includes('EATX'))) {
    form_factors.push('Mini-ITX');
  }
  // Deduplicate while preserving hierarchy order
  const FF_ORDER = ['E-ATX', 'ATX', 'Micro-ATX', 'Mini-ITX'];
  form_factors = FF_ORDER.filter(f => form_factors.includes(f));

  if (!max_cpu_cooler_height_mm && !max_gpu_length_mm && form_factors.length === 0) return null;

  return {
    max_cpu_cooler_height_mm,
    max_gpu_length_mm: max_gpu_length_mm ?? null,
    form_factors: form_factors.length > 0 ? form_factors : null,
  };
};

/**
 * RAM strategy — cas_latency, kit_config, ram_type
 *
 * Targets patterns found in Moroccan retail spec tables like:
 *   "Latence CAS: CL16" / "CL36-39-39-96" / "16-18-18-38"
 *   "Kit: 2x8Go" / "2 x 16 Go" / "Configuration: 2×16GB"
 *   "Type: DDR5" / "DDR4 4800 MHz"
 */
const ramStrategy: ExtractionStrategy = (cleaned) => {
  // ── CAS Latency ───────────────────────────────────────────────────────────
  // Match: CL16, CL 16, Latence CAS : CL21, Latence: 16, CAS: CL22, timing formats
  let cas_latency: number | null = null;
  const clPatterns = [
    /Latence[\s\w]*:\s*(?:CL)?\s*(\d{2})\b/i, // "Latence CAS : CL21", "Latence: 16"
    /(?:CAS|CL)\s*:?\s*(?:CL)?\s*(\d{2})\b/i,  // "CAS: CL22", "CL16", "CL 16", "CAS: 22"
    /\bCL[-\s]?(\d{2})\b/i,                  // "CL16", "CL 36", "CL-16"
    /\bCAS[-\s]?Latency[:\s]+(\d{2})\b/i,     // "CAS Latency: 36"
    /\bLatence[:\s]+CL?(\d{2})\b/i,           // "Latence: CL16" (French)
    /\bC(\d{2})-\d{2}-\d{2}/,                 // "C36-48-48-96" timing format
    /\b(\d{2})-\d{2}-\d{2}-\d{2,3}\b/,       // "16-18-18-38" raw timing string
  ];
  for (const re of clPatterns) {
    const m = cleaned.match(re);
    if (m?.[1]) {
      const v = parseInt(m[1], 10);
      if (v >= 8 && v <= 60) { cas_latency = v; break; }
    }
  }

  // ── Kit Configuration ─────────────────────────────────────────────────────
  // Match: "2x8GB", "2 x 16 Go", "Kit de 2", "2×16GB"
  let kit_count: number | null = null;
  const kitPatterns = [
    /\b(\d)\s*[x×*]\s*\d+\s*[Gg][BbOo]/,  // 2x8GB, 2×16Go
    /\b\d+\s*[Gg][BbOo]\s*[x×*]\s*(\d)/,  // 16Go×2
    /\bKit\s+(?:de\s+)?(\d)\b/i,            // Kit de 2
    /\b(\d)\s+barrette/i,                    // 2 barrettes
  ];
  for (const re of kitPatterns) {
    const m = cleaned.match(re);
    if (m) {
      // Find which capture group has the kit count
      const kitNum = m[1] ? parseInt(m[1], 10) : null;
      if (kitNum && kitNum >= 1 && kitNum <= 8) { kit_count = kitNum; break; }
    }
  }

  // ── Memory Type ───────────────────────────────────────────────────────────
  let ram_type: string | null = null;
  const ddrMatch = cleaned.match(/\b(DDR[345])\b/i);
  if (ddrMatch) ram_type = ddrMatch[1].toUpperCase();

  if (!cas_latency && !kit_count && !ram_type) return null;

  return {
    ...(cas_latency !== null && { cas_latency }),
    ...(kit_count !== null && { kit_count }),
    ...(ram_type !== null && { ram_type }),
  };
};

/**
 * PSU strategy — efficiency_rating, modularity
 *
 * Targets patterns like:
 *   "80 Plus Gold" / "80+ Platinum" / "80 Plus Titanium"
 *   "Full Modulaire" / "Semi-Modular" / "Non-Modulaire"
 */
const psuStrategy: ExtractionStrategy = (cleaned) => {
  // ── 80+ Efficiency Rating ─────────────────────────────────────────────────
  let efficiency: string | null = null;
  const efficiencyPatterns = [
    /\b80\s*(?:Plus|\+)\s*(Titanium|Platinum|Gold|Silver|Bronze|White)\b/i,
    /\b(Titanium|Platinum|Gold|Silver|Bronze)\s*80\s*(?:Plus|\+)\b/i,
    // French: "Certifiée 80+ Gold"
    /\bCertifi[eé][e]?\s+80\s*[+\s](Titanium|Platinum|Gold|Silver|Bronze|White)\b/i,
  ];
  for (const re of efficiencyPatterns) {
    const m = cleaned.match(re);
    if (m?.[1]) {
      const grade = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      efficiency = `80Plus ${grade}`;
      break;
    }
  }
  // Bare "80 Plus" with no tier
  if (!efficiency && /\b80\s*(?:Plus|\+)\b/i.test(cleaned)) {
    efficiency = '80Plus';
  }

  // ── Modularity ────────────────────────────────────────────────────────────
  let modularity: string | null = null;
  
  // 1. Suffix/Key-Value patterns: e.g. "Modulaire Non", "Modulaire: Non", "Modulaire: Oui", "Modulaire | Non"
  const suffixMatch = cleaned.match(/\bMod(?:ulaire|ular)\b\s*[:\-=|]?\s*\b(Full|Fully|Semi|Non|No|Yes|Oui)\b/i);
  if (suffixMatch) {
    const val = suffixMatch[1].toLowerCase();
    if (val === 'full' || val === 'fully' || val === 'yes' || val === 'oui') {
      modularity = 'Full';
    } else if (val === 'semi') {
      modularity = 'Semi';
    } else if (val === 'non' || val === 'no') {
      modularity = 'None';
    }
  }

  // 2. Prefix patterns: e.g. "Full Modulaire", "Semi-Modular", "Non-Modulaire"
  if (!modularity) {
    const modPatterns = [
      /\b(Full|Semi|Non)[-\s]*Modul(?:aire|ar)\b/i,  // Full Modulaire / Semi-Modular / Non-Modulaire
      /\b(Fully|Partiellement)\s*Modul(?:aire|ar)\b/i, // Fully Modular / Partiellement Modulaire
    ];
    for (const re of modPatterns) {
      const m = cleaned.match(re);
      if (m?.[1]) {
        const prefix = m[1].toLowerCase();
        if (prefix === 'full' || prefix === 'fully') modularity = 'Full';
        else if (prefix === 'semi' || prefix === 'partiellement') modularity = 'Semi';
        else if (prefix === 'non') modularity = 'None';
        break;
      }
    }
  }

  // 3. Fallback: Bare "Modulaire" with no "Non"/"No"/"Pas"/"Sans" nearby.
  if (!modularity && /\bMod(?:ulaire|ular)\b/i.test(cleaned)) {
    const lowerCleaned = cleaned.toLowerCase();
    const modIndex = lowerCleaned.indexOf('modulaire');
    const modularIndex = lowerCleaned.indexOf('modular');
    const idx = modIndex !== -1 ? modIndex : modularIndex;
    
    if (idx !== -1) {
      const start = Math.max(0, idx - 15);
      const end = Math.min(lowerCleaned.length, idx + 25);
      const windowText = lowerCleaned.slice(start, end);
      if (/\b(non|no|pas|sans)\b/.test(windowText)) {
        modularity = 'None';
      } else {
        modularity = 'Full';
      }
    } else {
      modularity = 'Full';
    }
  }

  if (!efficiency && !modularity) return null;

  return {
    ...(efficiency !== null && { efficiency }),
    ...(modularity !== null && { modularity }),
  };
};

/**
 * MOTHERBOARD strategy — form_factor, socket
 *
 * Targets patterns like:
 *   "Facteur de forme: ATX" / "Format: Micro-ATX"
 *   "Socket: LGA1700" / "Socket AM5" / "Connecteur: AM4"
 */
const motherboardStrategy: ExtractionStrategy = (cleaned) => {
  // ── Form Factor ───────────────────────────────────────────────────────────
  let form_factor: string | null = null;
  const ffPatterns = [
    /\b(?:Facteur de forme|Format|Form Factor|Formfaktor)[:\s]+([A-Za-z\-]{3,10}ATX|Mini[-\s]?ITX|ITX)\b/i,
    // Standalone form factor keywords
    /\b(E[-\s]?ATX|EATX)\b/i,
    /\b(Micro[-\s]?ATX|mATX|M[-\s]?ATX|MicroATX)\b/i,
    /\b(Mini[-\s]?ITX|Mini\s+ITX)\b/i,
    /\bATX\b/,  // bare ATX — matched last (least specific)
  ];
  for (const re of ffPatterns) {
    const m = cleaned.match(re);
    if (m) {
      const raw = (m[1] ?? m[0]).toUpperCase().replace(/\s+/g, '-');
      if (/E.?ATX/.test(raw)) { form_factor = 'E-ATX'; break; }
      if (/M(ICRO.)?ATX|MATX/.test(raw)) { form_factor = 'Micro-ATX'; break; }
      if (/MINI.?ITX|^ITX$/.test(raw)) { form_factor = 'Mini-ITX'; break; }
      if (raw === 'ATX') { form_factor = 'ATX'; break; }
    }
  }

  // ── Socket ────────────────────────────────────────────────────────────────
  let socket: string | null = null;
  // Intel LGA sockets
  const lgaMatch = cleaned.match(/\bLGA\s*(\d{3,4})\b/i);
  if (lgaMatch) socket = `LGA${lgaMatch[1]}`;

  // AMD sockets
  if (!socket) {
    const amMatch = cleaned.match(/\b(AM[2345]|sTR[45X]|sTRX4|sWRX[89]|TR4|FM[12])\b/i);
    if (amMatch) socket = amMatch[1].toUpperCase();
  }

  // French labels: "Socket: AM5", "Connecteur: LGA1700"
  if (!socket) {
    const labeledMatch = cleaned.match(/\b(?:Socket|Connecteur|Socle)\s*:?\s*(LGA\s*\d{3,4}|AM[2-5]|sTR[45X]|FM[12])\b/i);
    if (labeledMatch) socket = labeledMatch[1].toUpperCase().replace(/\s+/g, '');
  }

  if (!form_factor && !socket) return null;

  return {
    ...(form_factor !== null && { form_factor }),
    ...(socket !== null && { socket }),
  };
};

// ── Strategy Registry ─────────────────────────────────────────────────────────

const EXTRACTION_STRATEGIES: Record<string, ExtractionStrategy> = {
  case:        caseStrategy,
  ram:         ramStrategy,
  psu:         psuStrategy,
  alimentation: psuStrategy,  // French alias
  motherboard: motherboardStrategy,
  carte_mere:  motherboardStrategy, // French alias
};

const FORBIDDEN_MPNS = new Set([
  'GIGABYTE', 'PRIME', 'STRIX', 'AORUS', 'GAMING', 'BIOSTAR', 'ASROCK', 'SOCKET', 'TOMAHAWK', 'MAXIMUS', 'TORPEDO', 'CARTE',
  'MSI', 'ASUS', 'INTEL', 'AMD', 'CORSAIR', 'KINGSTON', 'CRUCIAL', 'SAMSUNG', 'WD', 'SEAGATE', 'RYZEN', 'GEFORCE', 'RADEON',
  'B550M', 'B660M', 'Z690M', 'B560M', 'B650M', 'H510M-A', 'H610M', 'B760M', 'Z790M', 'X670E', 'X870E'
]);

function extractUniversalIdentifiers(cleaned: string): { mpn: string | null; ean: string | null } {
  let mpn: string | null = null;
  let ean: string | null = null;

  // ── MPN / Part Number ─────────────────────────────────────────────────────
  const mpnPatterns = [
    /(?:code\s+produit|mpn|part\s*number|r[ée]f[ée]rence(?:\s+(?:constructeur|de\s+produit))?|model\s+number|p\/n)\s*[:\s-]+\s*([A-Z0-9\-\/]{5,25})\b/i,
    // Catch-all for common hardware MPN formats (alphanumeric, often with dashes)
    /\b([A-Z0-9]{2,10}[A-Z0-9\-]{3,15})\b/, 
  ];

  for (const re of mpnPatterns) {
    const m = cleaned.match(re);
    if (m?.[1]) {
      const candidate = m[1].trim();
      if (!FORBIDDEN_MPNS.has(candidate.toUpperCase()) && candidate.length >= 4) {
        mpn = candidate;
        break;
      }
    }
  }

  // ── EAN / Barcode ─────────────────────────────────────────────────────────
  const eanPatterns = [
    /(?:ean|code\s+barre|barcode)\s*[:\s-]+\s*(\d{8,14})\b/i,
    // Standalone 13-digit EAN-13 (very reliable)
    /\b(\d{13})\b/,
  ];

  for (const re of eanPatterns) {
    const m = cleaned.match(re);
    if (m?.[1]) {
      ean = m[1].trim();
      break;
    }
  }

  return { mpn, ean };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches the raw HTML of a product page and extracts specs via the
 * category-specific ExtractionStrategy.
 *
 * @param url      Product page URL to scrape
 * @param category Component category (case | ram | psu | motherboard | …)
 * @returns        ResolvedSpecs partial, or null if unreachable / nothing found
 */
export async function scrapeProductPage(url: string, category: string): Promise<ResolvedSpecs | null> {
  try {
    const cleaned = await fetchCleanedText(url);
    if (!cleaned) return null;

    // 1. Extract global identifiers (MPN/EAN)
    const { mpn, ean } = extractUniversalIdentifiers(cleaned);

    // 2. Dispatch to category strategy
    const strategy = EXTRACTION_STRATEGIES[category.toLowerCase()];
    const categoryResult = strategy ? strategy(cleaned) : null;

    if (!mpn && !ean && !categoryResult) {
      await logger.warn(`[DeepScraper] No specs or IDs found for ${url} (${category})`);
      return null;
    }

    const finalResult: ResolvedSpecs = {
      ...(mpn && { mpn }),
      ...(ean && { ean }),
      ...categoryResult,
    };

    await logger.info(`[DeepScraper] Extracted data for "${category}" from ${url}: ${JSON.stringify(finalResult)}`);
    return finalResult;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    await logger.error(`[DeepScraper] Error scraping ${url} (category: ${category}): ${msg}`);
    return null;
  }
}
