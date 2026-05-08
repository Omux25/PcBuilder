/**
 * Fix MPK/Bundle images by finding better alternatives from other retailers
 */

import { getSql } from '../../src/db/index.js';
import { scoreImageQuality } from '@shared/image-utils';

const sql = getSql();

console.log('🖼️  Fixing MPK/Bundle Images\n');

// Find components with MPK/Bundle images
const componentsWithBadImages = await sql`
  SELECT id, name, brand, category, image_url
  FROM components
  WHERE image_url ILIKE '%MPK%' OR image_url ILIKE '%BUNDLE%'
  ORDER BY id
` as { id: number; name: string; brand: string | null; category: string; image_url: string }[];

console.log(`Found ${componentsWithBadImages.length} components with MPK/Bundle images\n`);

if (componentsWithBadImages.length === 0) {
    console.log('✅ No MPK/Bundle images found!');
    process.exit(0);
}

let fixed = 0;
let skipped = 0;

for (const component of componentsWithBadImages) {
    // Find all prices for this component (different retailers may have better images)
    const prices = await sql`
    SELECT p.product_url, r.name as retailer_name, r.id as retailer_id
    FROM prices p
    JOIN retailers r ON r.id = p.retailer_id
    WHERE p.component_id = ${component.id}
  ` as { product_url: string; retailer_name: string; retailer_id: number }[];

    if (prices.length === 0) {
        skipped++;
        continue;
    }

    // For now, we can only check if there are alternative retailers
    // In a full implementation, we'd re-scrape those URLs to get their images
    // For this fix, we'll just clear the MPK image so it can be replaced on next scrape

    const currentScore = scoreImageQuality(component.image_url, component.name);

    if (currentScore < 0) {
        // Clear the bad image - it will be replaced on next scrape
        await sql`
      UPDATE components
      SET image_url = NULL
      WHERE id = ${component.id}
    `;
        fixed++;

        if (fixed <= 10) {
            console.log(`✅ Cleared MPK/Bundle image: [${component.category}] ${component.brand} ${component.name}`);
            console.log(`   Bad image: ${component.image_url.substring(0, 70)}...`);
            console.log(`   Available on ${prices.length} retailer(s) - will be replaced on next scrape\n`);
        }
    } else {
        skipped++;
    }
}

console.log(`\n📊 Summary:`);
console.log(`   - Fixed: ${fixed} (cleared bad images)`);
console.log(`   - Skipped: ${skipped}`);
console.log(`\n💡 Run the scrapers again to populate better images for these components.`);

process.exit(0);
