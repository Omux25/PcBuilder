// apps/backend/scripts/reprocess_unmatched.ts
import { reprocessUnmatched } from '../src/modules/scraping/engine/aggregator';
import { logger } from '../src/modules/scraping/engine/utils/logger';

async function main() {
  console.log('Starting reprocessing of unmatched listings...');
  try {
    const result = await reprocessUnmatched();
    console.log('Reprocessing complete!');
    console.log(`- Updated: ${result.updated}`);
    console.log(`- Unmatched: ${result.unmatched}`);
    console.log(`- Auto-mapped: ${result.autoMapped}`);
    console.log(`- Auto-created: ${result.autoCreated}`);
    console.log(`- Errors: ${result.errors}`);
  } catch (err) {
    console.error('Reprocessing failed:', err);
    process.exit(1);
  }
  process.exit(0);
}

main();
