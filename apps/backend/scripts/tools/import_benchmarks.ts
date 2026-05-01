import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSql } from '../../src/db/index.js';
import { findBestMatch } from '../../src/utils/componentMatcher.js';

async function importBenchmarks() {
  const sql = getSql();
  console.log('🚀 Starting Benchmark Import...');

  // 1. Load JSON Data
  const jsonPath = join(import.meta.dirname, '../data/benchmarks.json');
  let data;
  try {
    data = JSON.parse(await readFile(jsonPath, 'utf-8'));
  } catch (err) {
    console.error('Failed to load benchmarks.json', err);
    process.exit(1);
  }

  // 2. Fetch components from DB
  const components = (await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE category IN ('cpu', 'gpu')
  `) as { id: number; name: string; brand: string | null; category: string }[];

  const cpus = components.filter(c => c.category === 'cpu');
  const gpus = components.filter(c => c.category === 'gpu');

  let updated = 0;
  let missed = 0;

  // Helper to map and update
  async function mapCategory(items: { name: string; score: number }[], catalog: typeof components) {
    for (const item of items) {
      // Find match using our DNA matcher
      const match = findBestMatch(item.name, catalog, 1.0);
      if (match) {
        await sql`
          UPDATE components
          SET benchmark_score = ${item.score}
          WHERE id = ${match.componentId}
        `;
        updated++;
        console.log(`✅ Mapped [${item.name}] -> ID ${match.componentId}`);
      } else {
        missed++;
        console.log(`❌ No match found for: ${item.name}`);
      }
    }
  }

  // 3. Map CPUs
  console.log('\n--- Mapping CPUs ---');
  await mapCategory(data.cpu || [], cpus);

  // 4. Map GPUs
  console.log('\n--- Mapping GPUs ---');
  await mapCategory(data.gpu || [], gpus);

  console.log(`\n🎉 Import complete! Updated: ${updated}, Missed: ${missed}`);
  process.exit(0);
}

importBenchmarks().catch(console.error);
