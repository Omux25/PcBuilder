import { getSql } from '../apps/backend/src/core/db/index';

const COLOR_TOKENS = [
    'noir', 'blanc', 'black', 'white', 'blanche', 'noire',
    'rouge', 'red', 'blue', 'bleu', 'silver', 'argent', 'gold', 'or',
    'pink', 'rose', 'green', 'vert', 'purple', 'violet', 'grey', 'gray', 'gris',
];

const NOISE_TOKENS = [
    'kit', 'bundle', 'pack', 'combo', 'oem', 'retail', 'box',
    'edition', 'version',
    'tray', 'mpk', 'wof', 'pib', 'tary', 'traw', 'boxed', 'unlocked', 'sans ventilateur', 'avec ventilateur',
    'wraith stealth', 'wraith spire', 'wraith prism', 'wraith max', 'no fan', 'processeurs', 'processeur', 'processors', 'processor'
];

function deriveCanonicalNameImproved(scrapedName: string, brand: string | null, category: string | null): string {
    let name = scrapedName.trim();

    // Strip category prefix
    // Only strip if the prefix does NOT contain brands or model keywords (e.g. Ryzen, Core, Radeon, GeForce, AMD, Intel, RTX, GTX)
    const hasCpuGpuKeyword = /ryzen|intel|amd|core|geforce|radeon|rtx|gtx|rx\s+\d/i.test(name.split(/[\u2013-]/)[0]);
    if (!hasCpuGpuKeyword) {
        name = name.replace(/^[^\u2013-]*[\u2013-]\s+/, '').trim();
    }

    // Strip brand prefix (case-insensitive)
    if (brand) {
        const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        name = name.replace(new RegExp(`^${escaped}\\s*`, 'i'), '').trim();
    }

    // Category-specific pre-cleaning
    if (category === 'cpu') {
        // Strip socket mentions like "Socket LGA1700", "LGA 1700", "Socket AM5", "AM4", "Socket 1851", "LGA1851" etc.
        name = name.replace(/\b(socket\s+)?(lga\s*\d+|am[45]|115[01]|1200|1700|1851|2011|2066)\b/gi, ' ');
        
        // Strip core/thread configurations like "8C 16T", "6C/12T" etc.
        name = name.replace(/\b\d+\s*c\s*\d+\s*t\b/gi, ' ');
        name = name.replace(/\b\d+\s*c\/\d+\s*t\b/gi, ' ');

        // Strip GHz mentions and parentheses enclosing them, supporting missing closing parenthesis
        name = name.replace(/\(\s*[^)]*ghz[^)]*\)/gi, ' ');
        name = name.replace(/\(\s*[^)]*ghz.*/gi, ' ');
        // Strip standalone GHz mentions
        name = name.replace(/\b\d+(?:\.\d+)?\s*ghz\s*[\/\u2013-]\s*\d+(?:\.\d+)?\s*ghz\b/gi, ' ');
        name = name.replace(/\b\d+(?:\.\d+)?\s*ghz\b/gi, ' ');

        // Normalize space between Ryzen and its number tier: e.g. "Ryzen5" -> "Ryzen 5"
        name = name.replace(/\bryzen\s*([3579])\b/gi, 'Ryzen $1');

        // Normalize Intel Core formatting: e.g. "Core i5 12400F" or "i5 12400F" -> "Core i5-12400F"
        name = name.replace(/\b(?:core\s+)?i([3579])[-\s]+(\d+\w*)\b/gi, 'Core i$1-$2');
        
        // Normalize Intel Core Ultra formatting: e.g. "Core Ultra 5 245K" -> "Core Ultra 5 245K" (ensure consistent space/hyphen)
        name = name.replace(/\bcore\s+ultra\s+(\d)[-\s]+(\d+\w*)\b/gi, 'Core Ultra $1 $2');
        
        // Normalize AMD Ryzen formatting: e.g. "Ryzen 5-7600" -> "Ryzen 5 7600"
        name = name.replace(/\bryzen\s+(\d)[-\s]+(\d+\w*)\b/gi, 'Ryzen $1 $2');

        // Force uppercase for AMD 'X/XT/X3D' and Intel 'K/KF/KS/F' suffixes
        name = name.replace(/\b(\d{4,5})([xXtTkKfFsS]*)\b/g, (match, num, suffix) => {
            return num + suffix.toUpperCase();
        });
    }

    // Strip color and noise tokens (whole-word, case-insensitive)
    const allTokens = [...COLOR_TOKENS, ...NOISE_TOKENS];
    for (const token of allTokens) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (token.includes(' ')) {
            name = name.replace(new RegExp(escaped, 'gi'), ' ');
        } else {
            name = name.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
        }
    }

    // Normalize whitespace
    name = name.replace(/\s+/g, ' ').trim();

    // Clean up empty parentheses left after token stripping
    name = name.replace(/\(\s*\)/g, '').trim();

    // Strip leading/trailing dashes, dots, or en-dashes left after stripping
    name = name.replace(/^[\s\u2013.,-]+|[\s\u2013.,-]+$/g, '').trim();

    // Fallback
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

async function run() {
  const sql = getSql();
  
  // Fetch pending CPU listings
  const pending = await sql`
    SELECT ul.scraped_name, us.brand, us.category
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    WHERE ul.status = 'pending' AND us.category = 'cpu'
  `;
  
  console.log(`Loaded ${pending.length} pending CPU listings.`);
  
  const groupMap = new Map<string, string[]>();
  
  for (const item of pending) {
    const newCanonical = deriveCanonicalNameImproved(item.scraped_name, item.brand, item.category);
    if (!groupMap.has(newCanonical)) {
      groupMap.set(newCanonical, []);
    }
    groupMap.get(newCanonical)!.push(item.scraped_name);
  }
  
  console.log(`\nImproved normalization result: ${groupMap.size} groups (down from 233!)`);
  
  // Let's print the new groups sorted by count descending
  const sorted = [...groupMap.entries()].sort((a, b) => b[1].length - a[1].length);
  
  console.log("\nTop 30 newly consolidated CPU groups:");
  sorted.slice(0, 30).forEach(([canonical, list], i) => {
    console.log(`${i+1}. ${canonical} - ${list.length} listings`);
    console.log(`   Samples: ${list.slice(0, 4).join(" | ")}`);
  });
}

run().catch(console.error);
