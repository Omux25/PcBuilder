import { getSql } from '../core/db/index.js';
import { extractGpuSpecs } from '@shared/hardware/specs/gpu.js';
import * as fs from 'fs';
import * as path from 'path';

async function runEnrichment() {
  const sql = getSql();
  
  console.log('Querying failed GPUs in the database...');
  const failures = await sql`
    SELECT id, name, category, brand, specs
    FROM components
    WHERE category = 'gpu'
      AND (
        specs->>'chipset' IS NULL 
        OR specs->>'vram_gb' IS NULL
      )
    ORDER BY name ASC;
  ` as any[];

  console.log(`Found ${failures.length} target components to enrich.\n`);
  
  if (failures.length === 0) {
    console.log('No failed GPUs found in database.');
    return;
  }

  let healedCount = 0;
  
  // Use a transaction or run updates in a sequence
  await sql.begin(async (tx) => {
    for (const f of failures) {
      const enriched = extractGpuSpecs(f.name);
      
      if (enriched.chipset && enriched.vram_gb !== null) {
        const specsPayload = {
          chipset: enriched.chipset,
          vram_gb: enriched.vram_gb,
          tdp: enriched.tdp,
          length_mm: enriched.length_mm
        };
        
        await tx`
          UPDATE components
          SET 
            chipset = ${enriched.chipset},
            vram_gb = ${enriched.vram_gb},
            tdp = ${enriched.tdp},
            length_mm = ${enriched.length_mm},
            specs = ${specsPayload as any},
            updated_at = NOW()
          WHERE id = ${f.id};
        `;
        
        healedCount++;
      } else {
        console.warn(`⚠️ Could not fully heal ID: ${f.id} | Name: "${f.name}" | Specs: ${JSON.stringify(enriched)}`);
      }
    }
  });

  console.log(`\n🎉 Hydration Complete! Successfully healed and updated ${healedCount} GPUs in the database.`);

  // Cleanup temporary scripts
  const scriptsDir = __dirname;
  const tempScripts = ['analyze-failures.ts', 'check-generic.ts'];
  
  console.log('\nCleaning up temporary diagnostic scripts...');
  for (const script of tempScripts) {
    const scriptPath = path.join(scriptsDir, script);
    if (fs.existsSync(scriptPath)) {
      try {
        fs.unlinkSync(scriptPath);
        console.log(`Deleted temporary script: ${script}`);
      } catch (err) {
        console.error(`Failed to delete temporary script ${script}:`, err);
      }
    }
  }
}

runEnrichment()
  .then(() => {
    console.log('\nEnrichment task successfully finished!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Enrichment task failed with error:', err);
    process.exit(1);
  });
