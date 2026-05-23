/**
 * resolve-by-mpn.ts
 *
 * Script to re-resolve RAM and Motherboards with missing critical specs.
 * Extracts MPN/EAN from product pages and uses upgraded AI enrichment.
 */

import { getSql } from '../core/db/index.js';
import { scrapeProductPage } from '../modules/scraping/utils/deepScraper.js';
import { getDynamicEnrichment } from '@shared/hardware/services/dynamicEnrichment';
import { dbHardwareCache } from '../modules/scraping/services/dynamicEnrichmentService.js';

async function main() {
  const sql = getSql();

  // 1. Find target components
  console.log('[MPN-Resolver] Finding RAM and Motherboards with missing specs...');
  
  const targets = await sql`
    SELECT c.id, c.name, c.category, p.product_url
    FROM components c
    JOIN prices p ON c.id = p.component_id
    WHERE (
      (c.category = 'ram' AND (c.ram_type IS NULL OR c.cas_latency IS NULL)) OR
      (c.category = 'motherboard' AND (c.socket IS NULL OR c.supported_ram_types IS NULL))
    )
    AND p.product_url IS NOT NULL
    LIMIT 100 -- Process in batches
  ` as { id: number; name: string; category: string; product_url: string }[];

  console.log(`[MPN-Resolver] Found ${targets.length} components to heal.`);

  let successCount = 0;

  for (const target of targets) {
    try {
      console.log(`[MPN-Resolver] Healing "${target.name}" (${target.category}) via ${target.product_url}`);
      
      const resolved = await getDynamicEnrichment(
        target.name,
        target.category,
        dbHardwareCache,
        target.product_url,
        scrapeProductPage
      );

      if (resolved) {
        console.log(`[MPN-Resolver] Successfully resolved:`, resolved);
        
        // Update the component in DB
        // Mapping resolved specs to table columns
        const updates: any = {};
        if (resolved.mpn) updates.mpn = resolved.mpn;
        if (resolved.ean) updates.ean = resolved.ean;

        if (target.category === 'ram') {
          if (resolved.ram_type) updates.ram_type = resolved.ram_type;
          if (resolved.cas_latency) updates.cas_latency = resolved.cas_latency;
          if (resolved.frequency_mhz) updates.frequency_mhz = resolved.frequency_mhz;
        } else if (target.category === 'motherboard') {
          if (resolved.socket) updates.socket = resolved.socket;
          if (resolved.form_factor) updates.form_factor = resolved.form_factor;
          // Note: supported_ram_types and chipsets might need more complex mapping
        }

        if (Object.keys(updates).length > 0) {
          await sql`
            UPDATE components 
            SET ${sql(updates)}, updated_at = NOW()
            WHERE id = ${target.id}
          `;
          successCount++;
          console.log(`[MPN-Resolver] DB updated for ${target.name}`);
        }
      } else {
        console.warn(`[MPN-Resolver] Could not resolve ${target.name}`);
      }
    } catch (err) {
      console.error(`[MPN-Resolver] Failed to heal ${target.name}:`, err);
    }
  }

  console.log(`[MPN-Resolver] Finished. Healed ${successCount}/${targets.length} components.`);
  process.exit(0);
}

main().catch(err => {
  console.error('[MPN-Resolver] Fatal error:', err);
  process.exit(1);
});
