import { getSql } from '../apps/backend/src/core/db/index';

async function run() {
  const sql = getSql();
  
  const listings = await sql`
    SELECT ul.id, ul.scraped_name, ul.product_url, us.brand, us.category, us.canonical_name
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    WHERE ul.status = 'pending'
  `;
  
  console.log(`Scanning all ${listings.length} pending unmatched listings for cross-category anomalies...\n`);
  
  const anomalies: Array<{
    type: string;
    description: string;
    scraped_name: string;
    current_category: string | null;
    suggested_category: string;
    url: string;
  }> = [];
  
  for (const item of listings) {
    const scrapedName = item.scraped_name;
    const currentCategory = item.category;
    const lowerName = scrapedName.toLowerCase();
    
    // Skip if it mentions MHz / memory-related terms
    const isRamOrStoragePattern = /\b(mhz|cl\d{2}|ddr[345]|sata|nvme|ssd|m\.2|hard\s+drive|hdd|go\s+de\s+mémoire|go\s+ddr)\b/i.test(scrapedName);
    
    // --- 1. CPU in Non-CPU Category Check ---
    // Specifically target real CPU model identifiers and ignore frequencies in RAM/storage
    const hasCpuKeywords = (/\b(ryzen\s+[3579]\b|ryzen\s+threadripper|intel\s+core\s+i[3579]|core\s+ultra\s+[579]|core\s+i[3579]-|intel\s+xeon)\b/i.test(scrapedName) ||
                           (/\b(7800x3d|5800x3d|5700x3d|7600x|12400f|13400f|14700k|14900k|12100f|10400f|11400f|5600g|5600x)\b/i.test(scrapedName) ||
                            (/\b(3600|2600)\b/i.test(scrapedName) && !isRamOrStoragePattern))
                           ) && !/\b(watercooler|aio|cooler|ventirad|ventilateur|fan|paste|pate|thermique|grizzly)\b/i.test(scrapedName);
                            
    const isCpuCombo = /\b(combo|pack|kit\s+d'evolution|kit\s+d’evolution|kit\s+evolution|\+)\b/i.test(scrapedName) && 
                       /\b(carte\s+mere|carte\s+mère|motherboard|b550|b650|h610|b760|z790)\b/i.test(scrapedName);
                       
    if (hasCpuKeywords && !isCpuCombo && currentCategory !== 'cpu') {
      anomalies.push({
        type: 'CPU Mis-categorized',
        description: `Product mentions a major CPU model ("${scrapedName}") but is categorized as "${currentCategory}".`,
        scraped_name: scrapedName,
        current_category: currentCategory,
        suggested_category: 'cpu',
        url: item.product_url
      });
      continue;
    }
    
    // --- 2. GPU in Non-GPU Category Check ---
    const hasGpuKeywords = /\b(rtx\s*\d{4}|rx\s*\d{4}|gtx\s*\d{4}|geforce\s+rtx|geforce\s+gtx|radeon\s+rx|intel\s+arc\s+a\d{3})\b/i.test(scrapedName) ||
                           /\b(rtx\d{4}|gtx\d{4}|rx\d{4})\b/i.test(scrapedName);
    
    // Make sure it's not a block, cooler, backplate or bracket
    const isGpuAccessory = /\b(block|cooler|waterblock|backplate|bracket|support|holder|soutien|cable|riser|bridge|sli)\b/i.test(scrapedName);
    
    if (hasGpuKeywords && !isGpuAccessory && currentCategory !== 'gpu') {
      anomalies.push({
        type: 'GPU Mis-categorized',
        description: `Product mentions a GPU card ("${scrapedName}") but is categorized as "${currentCategory}".`,
        scraped_name: scrapedName,
        current_category: currentCategory,
        suggested_category: 'gpu',
        url: item.product_url
      });
      continue;
    }
    
    // --- 3. Cooler/Fan in CPU Category Check ---
    const isCoolerInCpu = /\b(watercooler|aio|cooler|ventirad|ventilateur|fan|paste|pate|thermique|grizzly)\b/i.test(scrapedName) && 
                          !/\b(ryzen|intel|core)\b/i.test(scrapedName) && 
                          currentCategory === 'cpu';
                          
    if (isCoolerInCpu) {
      anomalies.push({
        type: 'Cooler in CPU Category',
        description: `Product appears to be a cooling accessory ("${scrapedName}") but is categorized as "cpu".`,
        scraped_name: scrapedName,
        current_category: currentCategory,
        suggested_category: 'cooling',
        url: item.product_url
      });
      continue;
    }
    
    // --- 4. Motherboard in Non-Motherboard Category Check ---
    const hasMotherboardKeywords = /\b(motherboard|carte\s+mere|carte\s+mère|b550m|b650m|h610m|a520m|b760m|x670e|z790|z690|b650\s+aorus|b550\s+aorus)\b/i.test(scrapedName);
    
    if (hasMotherboardKeywords && !hasCpuKeywords && currentCategory !== 'motherboard' && !isRamOrStoragePattern) {
      anomalies.push({
        type: 'Motherboard Mis-categorized',
        description: `Product mentions a motherboard chipset ("${scrapedName}") but is categorized as "${currentCategory}".`,
        scraped_name: scrapedName,
        current_category: currentCategory,
        suggested_category: 'motherboard',
        url: item.product_url
      });
      continue;
    }
  }
  
  console.log(`=== CROSS-CATEGORY AUDIT SUMMARY ===`);
  console.log(`Total listings scanned: ${listings.length}`);
  console.log(`Total anomalies found: ${anomalies.length}\n`);
  
  const grouped = new Map<string, typeof anomalies>();
  for (const a of anomalies) {
    if (!grouped.has(a.type)) {
      grouped.set(a.type, []);
    }
    grouped.get(a.type)!.push(a);
  }
  
  for (const [type, list] of grouped.entries()) {
    console.log(`\n🔴 [${type}] - ${list.length} cases:`);
    list.slice(0, 10).forEach((a, idx) => {
      console.log(`  ${idx + 1}. Scraped: "${a.scraped_name}"`);
      console.log(`     Current Category: "${a.current_category}" -> Suggested: "${a.suggested_category}"`);
      console.log(`     Issue:            ${a.description}`);
      console.log(`     Link:             ${a.url}`);
    });
    if (list.length > 10) {
      console.log(`  ... and ${list.length - 10} more cases.`);
    }
  }
}

run().catch(console.error).then(() => process.exit(0));
