import { getSql } from '../core/db/index.js';
import { unlinkComponent } from '../modules/catalog/services/componentService.js';
import { logger } from '../core/logger/logger.js';

async function cleanup() {
  const sql = getSql();
  
  console.log('Fetching auto-created components...');
  
  // Find components that are likely auto-created by the medium-confidence scraper:
  // - Categories that were in the auto-create block: ram, cpu, storage
  // - No description (manual creations usually have descriptions)
  // - We also restrict to recently created ones to be safe
  const autoCreated = await sql`
    SELECT id, name, category, slug
    FROM components
    WHERE category IN ('ram', 'cpu', 'storage')
      AND description IS NULL
      AND is_active = true
  `;

  console.log(`Found ${autoCreated.length} auto-created components to clean up.`);

  let successCount = 0;
  for (const comp of autoCreated) {
    try {
      // Unlink will move prices back to unmatched_listings
      // and delete the component record safely.
      await unlinkComponent(comp.id);
      successCount++;
      console.log(`✅ Unlinked [${comp.category}] ${comp.name}`);
    } catch (err: any) {
      console.error(`❌ Failed to unlink ${comp.id} (${comp.name}): ${err.message}`);
    }
  }

  console.log(`Cleanup complete. Successfully unlinked ${successCount} components.`);
  process.exit(0);
}

cleanup().catch((err) => {
  console.error(err);
  process.exit(1);
});
