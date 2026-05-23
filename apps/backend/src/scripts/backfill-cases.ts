import { getSql } from '../core/db/index.js';
import { dbHardwareCache } from '../modules/scraping/services/dynamicEnrichmentService.js';

function inferCaseSpecs(name: string, brand: string) {
  let max_gpu_length_mm = 330;
  let max_cpu_cooler_height_mm = 160;
  let form_factors = ['ATX', 'mATX', 'Mini-ITX'];
  
  const lowerName = name.toLowerCase();
  const lowerBrand = brand.toLowerCase();
  
  // Specific brands / models
  if (lowerBrand === 'mars gaming') {
    if (lowerName.includes('mcm') || lowerName.includes('micro') || lowerName.includes('mini')) {
      form_factors = ['mATX', 'Mini-ITX'];
      max_gpu_length_mm = 260; 
    } else if (lowerName.includes('mca')) {
      form_factors = ['ATX', 'mATX', 'Mini-ITX'];
      max_gpu_length_mm = 315;
    } else if (lowerName.includes('mc777')) {
      form_factors = ['ATX', 'mATX', 'Mini-ITX'];
      max_gpu_length_mm = 318;
    } else if (lowerName.includes('mcz')) {
      form_factors = ['mATX', 'Mini-ITX'];
      max_gpu_length_mm = 315;
    } else {
      max_gpu_length_mm = 315;
    }
  }
  
  // Form factor inference from name
  if (lowerName.includes('mini') || lowerName.includes('micro') || lowerName.includes('m-atx') || lowerName.includes('matx')) {
    form_factors = form_factors.filter(f => f !== 'ATX' && f !== 'E-ATX');
  }
  if (lowerName.includes('itx')) {
    form_factors = ['Mini-ITX'];
    max_gpu_length_mm = 300;
  }
  if (lowerName.includes('xl') || lowerName.includes('e-atx') || lowerName.includes('eatx') || lowerName.includes('full tower')) {
    form_factors = ['E-ATX', 'ATX', 'mATX', 'Mini-ITX'];
    max_gpu_length_mm = 400;
  }

  // Model specific inferences
  if (lowerName.includes('o11 dynamic') || lowerName.includes('o11d')) {
    form_factors = ['E-ATX', 'ATX', 'mATX', 'Mini-ITX'];
    max_gpu_length_mm = 420;
    max_cpu_cooler_height_mm = 167;
  }
  if (lowerName.includes('h510')) {
    max_gpu_length_mm = 381;
    max_cpu_cooler_height_mm = 165;
  }
  if (lowerName.includes('h5 ') || lowerName.includes('h5 flow')) {
    max_gpu_length_mm = 365;
  }
  if (lowerName.includes('h7 ')) {
    max_gpu_length_mm = 400;
    max_cpu_cooler_height_mm = 185;
  }
  if (lowerName.includes('torrent')) {
    form_factors = ['E-ATX', 'ATX', 'mATX', 'Mini-ITX'];
    max_gpu_length_mm = 423;
    max_cpu_cooler_height_mm = 188;
  }
  if (lowerName.includes('meshify c')) {
    max_gpu_length_mm = 315;
    max_cpu_cooler_height_mm = 170;
  }
  if (lowerName.includes('4000d')) {
    form_factors = ['E-ATX', 'ATX', 'mATX', 'Mini-ITX'];
    max_gpu_length_mm = 360;
    max_cpu_cooler_height_mm = 170;
  }
  if (lowerName.includes('5000d')) {
    form_factors = ['E-ATX', 'ATX', 'mATX', 'Mini-ITX'];
    max_gpu_length_mm = 400;
    max_cpu_cooler_height_mm = 170;
  }
  
  return { form_factors, max_gpu_length_mm, max_cpu_cooler_height_mm };
}

async function backfillCases() {
  const sql = getSql();
  
  console.log("Fetching broken cases...");
  const cases = await sql`
    SELECT id, name, brand, max_gpu_length_mm, specs
    FROM components
    WHERE category = 'case' 
      AND (max_gpu_length_mm IS NULL OR specs->>'form_factors' IS NULL)
  `;

  let healed = 0;

  for (const c of cases) {
    const inferred = inferCaseSpecs(c.name, c.brand || '');
    
    let currentSpecs = c.specs || {};
    if (typeof currentSpecs === 'string') {
        try { currentSpecs = JSON.parse(currentSpecs); } catch { currentSpecs = {}; }
    }
    
    const final_gpu_length = c.max_gpu_length_mm || currentSpecs.max_gpu_length_mm || inferred.max_gpu_length_mm;
    const final_cooler_height = currentSpecs.max_cpu_cooler_height_mm || inferred.max_cpu_cooler_height_mm;
    const final_form_factors = currentSpecs.form_factors || inferred.form_factors;
    
    const specsPayload = {
      ...currentSpecs,
      max_gpu_length_mm: final_gpu_length,
      max_cpu_cooler_height_mm: final_cooler_height,
      form_factors: final_form_factors
    };

    const cachePayload = {
      max_gpu_length_mm: final_gpu_length,
      max_cpu_cooler_height_mm: final_cooler_height,
      form_factors: final_form_factors
    };
    
    await dbHardwareCache.set(c.name, 'case', cachePayload);

    await sql`
      UPDATE components 
      SET max_gpu_length_mm = ${final_gpu_length},
          specs = ${specsPayload},
          updated_at = NOW()
      WHERE id = ${c.id}
    `;

    healed++;
  }
  
  console.log(`Successfully healed ${healed} Cases.`);
  await sql.end();
}

backfillCases().catch(console.error);
