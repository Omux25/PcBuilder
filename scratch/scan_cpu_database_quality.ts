import { getSql } from '../apps/backend/src/core/db/index';
import { deriveCanonicalName } from '../apps/backend/src/modules/scraping/services/suggestionEngine';
import { extractCpuSpecs, COMMON_CPU_STATS } from '../shared/hardware/specs/cpu';

async function run() {
  const sql = getSql();
  
  // Fetch pending CPU listings
  const listings = await sql`
    SELECT ul.id, ul.scraped_name, ul.product_url, us.brand, us.category, us.canonical_name
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    WHERE ul.status = 'pending' AND us.category = 'cpu'
  `;
  
  console.log(`Auditing ${listings.length} pending CPU unmatched listings...\n`);
  
  const anomalies: Array<{
    type: string;
    description: string;
    scraped_name: string;
    brand: string | null;
    canonical_name: string | null;
    url: string;
  }> = [];
  
  for (const item of listings) {
    const scrapedName = item.scraped_name;
    const brand = item.brand;
    const canonical = item.canonical_name || deriveCanonicalName(scrapedName, brand, 'cpu');
    const lowerScraped = scrapedName.toLowerCase();
    const lowerCanonical = canonical.toLowerCase();
    
    // --- 1. Mismatched Category Check ---
    const isCooler = /\b(ventirad|cooler|fan|ventilateur|watercooling|aio|watercooler|liquid\s+cooling|liquid\s+cooler|rgb\s+fan|kraken|assassin|ak400|ak620|hyper\s+212|thermalright|peerless\s+assassin|prism|stealth|spire)\b/i.test(scrapedName) &&
                     !/\b(ryzen|intel|amd|core|i3|i5|i7|i9|ultra\s+[579])\b/i.test(scrapedName); // Skip actual CPUs that mention coolers like Wraith Stealth
    
    const isThermalPaste = /\b(thermal\s+paste|pate\s+thermique|pâte\s+thermique|thermal\s+grease|grizzly|kryonaut|mx-4|mx-6)\b/i.test(scrapedName);
    const isMotherboardCombo = /\b(motherboard|carte\s+mere|carte\s+mère|combo\s+carte|pack\s+carte|b550|b650|h610|a520|x670|z790|z690|b760|h670|combo|kit\s+d'evolution|kit\s+d’evolution|kit\s+evolution)\b/i.test(scrapedName) && 
                               /\b(ryzen|intel|core)\b/i.test(scrapedName) && 
                               (/\b(\+|\bplus\b|et|with|avec|pack|combo)\b/i.test(scrapedName) || scrapedName.includes('+'));
                               
    if (isCooler) {
      anomalies.push({
        type: 'Mismatched Category (Cooler)',
        description: `Listing appears to be a CPU Cooler, but is categorized as CPU.`,
        scraped_name: scrapedName,
        brand,
        canonical_name: canonical,
        url: item.product_url
      });
      continue;
    }
    
    if (isThermalPaste) {
      anomalies.push({
        type: 'Mismatched Category (Thermal Paste)',
        description: `Listing appears to be Thermal Paste, but is categorized as CPU.`,
        scraped_name: scrapedName,
        brand,
        canonical_name: canonical,
        url: item.product_url
      });
      continue;
    }
    
    if (isMotherboardCombo) {
      anomalies.push({
        type: 'Mismatched Category (Combo/Pack)',
        description: `Listing appears to be a Motherboard + CPU Combo or Bundle, but is categorized as a CPU.`,
        scraped_name: scrapedName,
        brand,
        canonical_name: canonical,
        url: item.product_url
      });
      continue;
    }
    
    // --- 2. GHz Remaining in Canonical Name ---
    if (/\b\d+(\.\d+)?\s*ghz\b/i.test(canonical) || canonical.includes('GHz') || canonical.includes('ghz')) {
      anomalies.push({
        type: 'GHz Remaining',
        description: `Canonical name still contains frequency/GHz mentions: "${canonical}".`,
        scraped_name: scrapedName,
        brand,
        canonical_name: canonical,
        url: item.product_url
      });
    }
    
    // --- 3. Invalid CPU Model Brand/Tier Typo ---
    // Ryzen 3 3400G (Should be Ryzen 5 3400G)
    if (lowerScraped.includes('ryzen 3') && lowerScraped.includes('3400g')) {
      anomalies.push({
        type: 'Model Brand/Tier Typo',
        description: `Scraped as "Ryzen 3 3400G", but Ryzen 3400G is a Ryzen 5 series processor.`,
        scraped_name: scrapedName,
        brand,
        canonical_name: canonical,
        url: item.product_url
      });
    }
    // Ryzen 5 3900X or i7 12400F etc (cross check using COMMON_CPU_STATS)
    let matchedModel: string | null = null;
    for (const model of Object.keys(COMMON_CPU_STATS)) {
      if (lowerScraped.includes(model.toLowerCase())) {
        matchedModel = model;
        break;
      }
    }
    
    if (matchedModel) {
      // Check tier mismatch
      const stats = COMMON_CPU_STATS[matchedModel];
      
      // Let's infer if there is a mismatch
      // Intel i3, i5, i7, i9
      const isIntel = brand?.toLowerCase() === 'intel' || lowerScraped.includes('intel');
      const isAmd = brand?.toLowerCase() === 'amd' || lowerScraped.includes('amd') || lowerScraped.includes('ryzen');
      
      if (isIntel) {
        const i3Match = lowerScraped.includes('i3');
        const i5Match = lowerScraped.includes('i5');
        const i7Match = lowerScraped.includes('i7');
        const i9Match = lowerScraped.includes('i9');
        const ultra5Match = lowerScraped.includes('ultra 5') || lowerScraped.includes('ultra5');
        const ultra7Match = lowerScraped.includes('ultra 7') || lowerScraped.includes('ultra7');
        const ultra9Match = lowerScraped.includes('ultra 9') || lowerScraped.includes('ultra9');
        
        // Find correct tier
        let correctTier = '';
        const numId = parseInt(matchedModel);
        if (matchedModel.startsWith('285') || matchedModel.startsWith('285K')) correctTier = 'Ultra 9';
        else if (matchedModel.startsWith('265') || matchedModel.startsWith('265K')) correctTier = 'Ultra 7';
        else if (matchedModel.startsWith('245') || matchedModel.startsWith('245K') || matchedModel.startsWith('225')) correctTier = 'Ultra 5';
        else if (matchedModel.startsWith('14900') || matchedModel.startsWith('13900') || matchedModel.startsWith('12900') || matchedModel.startsWith('10900') || matchedModel.startsWith('11900')) correctTier = 'i9';
        else if (matchedModel.startsWith('14700') || matchedModel.startsWith('13700') || matchedModel.startsWith('12700') || matchedModel.startsWith('10700') || matchedModel.startsWith('11700')) correctTier = 'i7';
        else if (matchedModel.startsWith('14600') || matchedModel.startsWith('14500') || matchedModel.startsWith('14400') || matchedModel.startsWith('13600') || matchedModel.startsWith('13500') || matchedModel.startsWith('13400') || matchedModel.startsWith('12600') || matchedModel.startsWith('12500') || matchedModel.startsWith('12400') || matchedModel.startsWith('11600') || matchedModel.startsWith('11400') || matchedModel.startsWith('10600') || matchedModel.startsWith('10400') || matchedModel.startsWith('9600') || matchedModel.startsWith('9400')) correctTier = 'i5';
        else if (matchedModel.startsWith('14100') || matchedModel.startsWith('13100') || matchedModel.startsWith('12100') || matchedModel.startsWith('10105') || matchedModel.startsWith('10100')) correctTier = 'i3';
        
        if (correctTier === 'i9' && (i3Match || i5Match || i7Match)) {
          anomalies.push({
            type: 'Model Brand/Tier Typo',
            description: `Intel model "${matchedModel}" is i9 tier, but scraped name mentions a lower tier (i3/i5/i7).`,
            scraped_name: scrapedName,
            brand,
            canonical_name: canonical,
            url: item.product_url
          });
        } else if (correctTier === 'i7' && (i3Match || i5Match || i9Match)) {
          anomalies.push({
            type: 'Model Brand/Tier Typo',
            description: `Intel model "${matchedModel}" is i7 tier, but scraped name mentions a different tier (i3/i5/i9).`,
            scraped_name: scrapedName,
            brand,
            canonical_name: canonical,
            url: item.product_url
          });
        } else if (correctTier === 'i5' && (i3Match || i7Match || i9Match)) {
          anomalies.push({
            type: 'Model Brand/Tier Typo',
            description: `Intel model "${matchedModel}" is i5 tier, but scraped name mentions a different tier (i3/i7/i9).`,
            scraped_name: scrapedName,
            brand,
            canonical_name: canonical,
            url: item.product_url
          });
        } else if (correctTier === 'i3' && (i5Match || i7Match || i9Match)) {
          anomalies.push({
            type: 'Model Brand/Tier Typo',
            description: `Intel model "${matchedModel}" is i3 tier, but scraped name mentions a different tier (i5/i7/i9).`,
            scraped_name: scrapedName,
            brand,
            canonical_name: canonical,
            url: item.product_url
          });
        }
      } else if (isAmd) {
        const r3Match = lowerScraped.includes('ryzen 3') || lowerScraped.includes('r3');
        const r5Match = lowerScraped.includes('ryzen 5') || lowerScraped.includes('r5');
        const r7Match = lowerScraped.includes('ryzen 7') || lowerScraped.includes('r7');
        const r9Match = lowerScraped.includes('ryzen 9') || lowerScraped.includes('r9');
        
        let correctTier = '';
        if (matchedModel.startsWith('9950') || matchedModel.startsWith('9900') || matchedModel.startsWith('7950') || matchedModel.startsWith('7900') || matchedModel.startsWith('5950') || matchedModel.startsWith('5900') || matchedModel.startsWith('3950') || matchedModel.startsWith('3900')) correctTier = 'Ryzen 9';
        else if (matchedModel.startsWith('9850') || matchedModel.startsWith('9800') || matchedModel.startsWith('9700') || matchedModel.startsWith('7800') || matchedModel.startsWith('7700') || matchedModel.startsWith('5800') || matchedModel.startsWith('5700') || matchedModel.startsWith('3800') || matchedModel.startsWith('3700')) correctTier = 'Ryzen 7';
        else if (matchedModel.startsWith('9600') || matchedModel.startsWith('8600') || matchedModel.startsWith('8500') || matchedModel.startsWith('8400') || matchedModel.startsWith('7600') || matchedModel.startsWith('7500') || matchedModel.startsWith('5650') || matchedModel.startsWith('5655') || matchedModel.startsWith('5600') || matchedModel.startsWith('5500') || matchedModel.startsWith('4650') || matchedModel.startsWith('4600') || matchedModel.startsWith('4500') || matchedModel.startsWith('3600') || matchedModel.startsWith('3500') || matchedModel.startsWith('3400') || matchedModel.startsWith('2600') || matchedModel.startsWith('2400')) correctTier = 'Ryzen 5';
        else if (matchedModel.startsWith('5350') || matchedModel.startsWith('4300') || matchedModel.startsWith('4100') || matchedModel.startsWith('3300') || matchedModel.startsWith('3200') || matchedModel.startsWith('3100') || matchedModel.startsWith('2200')) correctTier = 'Ryzen 3';
        
        if (correctTier === 'Ryzen 9' && (r3Match || r5Match || r7Match)) {
          anomalies.push({
            type: 'Model Brand/Tier Typo',
            description: `AMD model "${matchedModel}" is Ryzen 9, but scraped name mentions a lower tier (Ryzen 3/5/7).`,
            scraped_name: scrapedName,
            brand,
            canonical_name: canonical,
            url: item.product_url
          });
        } else if (correctTier === 'Ryzen 7' && (r3Match || r5Match || r9Match)) {
          anomalies.push({
            type: 'Model Brand/Tier Typo',
            description: `AMD model "${matchedModel}" is Ryzen 7, but scraped name mentions a different tier (Ryzen 3/5/9).`,
            scraped_name: scrapedName,
            brand,
            canonical_name: canonical,
            url: item.product_url
          });
        } else if (correctTier === 'Ryzen 5' && (r3Match || r7Match || r9Match) && matchedModel !== '3400') { // 3400G has Ryzen 3 exception checked above
          anomalies.push({
            type: 'Model Brand/Tier Typo',
            description: `AMD model "${matchedModel}" is Ryzen 5, but scraped name mentions a different tier (Ryzen 3/7/9).`,
            scraped_name: scrapedName,
            brand,
            canonical_name: canonical,
            url: item.product_url
          });
        } else if (correctTier === 'Ryzen 3' && (r5Match || r7Match || r9Match)) {
          anomalies.push({
            type: 'Model Brand/Tier Typo',
            description: `AMD model "${matchedModel}" is Ryzen 3, but scraped name mentions a higher tier (Ryzen 5/7/9).`,
            scraped_name: scrapedName,
            brand,
            canonical_name: canonical,
            url: item.product_url
          });
        }
      }
    }
    
    // --- 4. Invalid Model Socket Mismatch ---
    if (matchedModel) {
      const stats = COMMON_CPU_STATS[matchedModel];
      const correctSocket = stats.socket;
      
      const socketMatch = scrapedName.match(/\b(LGA\s*1700|LGA\s*1851|AM[45]|LGA\s*1200|LGA\s*1151)\b/i);
      if (socketMatch) {
        const explicitlyStatedSocket = socketMatch[1].toUpperCase().replace(/\s+/, '');
        if (explicitlyStatedSocket !== correctSocket) {
          anomalies.push({
            type: 'Socket Mismatch',
            description: `Model "${matchedModel}" belongs to socket ${correctSocket}, but scraped name explicitly states socket ${explicitlyStatedSocket}.`,
            scraped_name: scrapedName,
            brand,
            canonical_name: canonical,
            url: item.product_url
          });
        }
      }
    }
    
    // --- 5. Formatting Inconsistencies ---
    // Look for lowercase Intel K/KF/F suffixes in canonical name
    if (brand?.toLowerCase() === 'intel' && /[0-9]+[kKfFsS]\b/.test(canonical) && !/[0-9]+[KFS]/.test(canonical)) {
      anomalies.push({
        type: 'Formatting Casing Mismatch',
        description: `Intel model suffix is not capitalized in canonical name: "${canonical}".`,
        scraped_name: scrapedName,
        brand,
        canonical_name: canonical,
        url: item.product_url
      });
    }
    // Look for lowercase AMD X/XT/X3D/G/GT suffixes in canonical name
    if (brand?.toLowerCase() === 'amd' && /[0-9]+[xXtTgG]\b/.test(canonical) && !/[0-9]+[XTG]/.test(canonical)) {
      anomalies.push({
        type: 'Formatting Casing Mismatch',
        description: `AMD model suffix is not capitalized in canonical name: "${canonical}".`,
        scraped_name: scrapedName,
        brand,
        canonical_name: canonical,
        url: item.product_url
      });
    }
    // Missing space in Ryzen tier (e.g. Ryzen5 or Ryzen7 or Ryzen9)
    if (/\bryzen\d/i.test(canonical)) {
      anomalies.push({
        type: 'Formatting Space Mismatch',
        description: `Missing space in Ryzen tier: "${canonical}".`,
        scraped_name: scrapedName,
        brand,
        canonical_name: canonical,
        url: item.product_url
      });
    }
    // Missing brand in canonical name
    if (!canonical.toLowerCase().startsWith('intel') && !canonical.toLowerCase().startsWith('ryzen') && !canonical.toLowerCase().startsWith('amd')) {
      // If it starts with Core or i5 or i7, it lacks Intel/AMD.
      if (/^(core|i[3579]-|ultra)/i.test(canonical)) {
        anomalies.push({
          type: 'Missing Brand Prefix',
          description: `Canonical name is missing Intel/AMD prefix: "${canonical}".`,
          scraped_name: scrapedName,
          brand,
          canonical_name: canonical,
          url: item.product_url
        });
      }
    }
    
    // --- 6. Missing Tier in Intel/AMD Names ---
    // e.g. "Intel Core 12400F" (missing "i5") or "AMD Ryzen 5600" (missing "5")
    if (lowerScraped.includes('core') && !lowerScraped.includes('i3') && !lowerScraped.includes('i5') && !lowerScraped.includes('i7') && !lowerScraped.includes('i9') && !lowerScraped.includes('ultra') && matchedModel) {
      anomalies.push({
        type: 'Missing Tier (Intel)',
        description: `Scraped as "Intel Core ${matchedModel}" but lacks the tier "i3/i5/i7/i9".`,
        scraped_name: scrapedName,
        brand,
        canonical_name: canonical,
        url: item.product_url
      });
    }
    if (lowerScraped.includes('ryzen') && !lowerScraped.includes('ryzen 3') && !lowerScraped.includes('ryzen 5') && !lowerScraped.includes('ryzen 7') && !lowerScraped.includes('ryzen 9') && !lowerScraped.includes('threadripper') && matchedModel) {
      anomalies.push({
        type: 'Missing Tier (AMD)',
        description: `Scraped as "AMD Ryzen ${matchedModel}" but lacks the tier "3/5/7/9".`,
        scraped_name: scrapedName,
        brand,
        canonical_name: canonical,
        url: item.product_url
      });
    }
  }
  
  console.log(`=== AUDIT SUMMARY ===`);
  console.log(`Total listings scanned: ${listings.length}`);
  console.log(`Total anomalies found: ${anomalies.length}\n`);
  
  // Group anomalies by type for reporting
  const grouped = new Map<string, typeof anomalies>();
  for (const a of anomalies) {
    if (!grouped.has(a.type)) {
      grouped.set(a.type, []);
    }
    grouped.get(a.type)!.push(a);
  }
  
  for (const [type, list] of grouped.entries()) {
    console.log(`\n🔴 [${type}] - ${list.length} cases:`);
    list.slice(0, 5).forEach((a, idx) => {
      console.log(`  ${idx + 1}. Scraped: "${a.scraped_name}"`);
      console.log(`     Canonical: "${a.canonical_name}"`);
      console.log(`     Issue:     ${a.description}`);
      console.log(`     Link:      ${a.url}`);
    });
    if (list.length > 5) {
      console.log(`  ... and ${list.length - 5} more cases.`);
    }
  }
}

run().catch(console.error).then(() => process.exit(0));
