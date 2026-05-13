/**
 * import_benchmarks.ts — manually trigger benchmark score import.
 *
 * This is also called automatically at the end of each scraping session.
 * Run manually with: bun scripts/tools/import_benchmarks.ts
 */

import { importBenchmarks } from '../../src/modules/scraping/engine/benchmarkImporter.js';

console.log('🚀 Starting Benchmark Import...');
const { updated, missed } = await importBenchmarks();
console.log(`\n🎉 Import complete! Updated: ${updated}, Missed: ${missed}`);
process.exit(0);
