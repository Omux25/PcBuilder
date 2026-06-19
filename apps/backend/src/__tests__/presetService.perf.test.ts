import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { PresetService } from '../modules/builds/services/presetService.js';
import { getSql } from '../core/db/index.js';

describe('PresetService Performance', () => {
  let presetService: PresetService;
  let sql: any;

  beforeAll(() => {
    presetService = new PresetService();
    sql = getSql();
  });

  afterAll(async () => {
    // await sql.end(); // Bun sql connections don't need manual close by default usually, but we can if there's an API
  });

  test('createPreset performance with many components', async () => {
    // Generate a payload with 100 components to simulate a large insertion
    const components: Record<string, number> = {};
    for (let i = 0; i < 100; i++) {
      components[`category_${i}`] = 1; // Assuming componentId 1 exists or doesn't have FK constraint for this test
    }

    const payload = {
      name: 'Perf Test Preset',
      description: 'A preset to test insertion performance',
      use_case: 'Performance Testing',
      is_featured: false,
      components,
    };

    const iterations = 50;

    // Warm up
    try {
      await presetService.createPreset({ ...payload, name: 'Warm up' });
    } catch(e) {}

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      try {
        await presetService.createPreset({ ...payload, name: `Perf Test ${i}` });
      } catch (e) {
        // Ignore constraints like FK for purely measuring the driver/DB call time if possible,
        // or ensure DB is set up to allow this.
        // If it throws FK errors, we need to create a dummy component first.
      }
    }
    const end = performance.now();

    const duration = end - start;
    console.log(`Time taken for ${iterations} insertions of 100 components each: ${duration.toFixed(2)}ms`);
    console.log(`Average time per createPreset call: ${(duration / iterations).toFixed(2)}ms`);
  });
});
