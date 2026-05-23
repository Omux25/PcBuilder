import { getSql } from '../core/db/index.js';

/**
 * apps/backend/src/scripts/global-backfill.ts
 *
 * One-time backfill using LLM's internal hardware knowledge to heal missing GPU specs.
 */

async function runBackfill() {
  const sql = getSql();
  
  console.log('🔍 Querying GPUs with missing length_mm...');
  const missing = await sql`
    SELECT id, name, brand FROM components 
    WHERE category = 'gpu' AND length_mm IS NULL
  ` as { id: number; name: string; brand: string }[];
  
  console.log(`📊 Found ${missing.length} components requiring healing.`);

  const cacheInserts: any[] = [];
  let healedCount = 0;

  for (const gpu of missing) {
    const specs = resolveGpuSpecs(gpu.name, gpu.brand);
    
    if (specs && specs.length_mm) {
      cacheInserts.push({
        hardware_type: 'gpu',
        query_string: gpu.name,
        resolved_specs: specs
      });

      // Update the component directly
      // We use a merge to preserve existing JSONB specs
      await sql`
        UPDATE components 
        SET length_mm = ${specs.length_mm},
            tdp = COALESCE(tdp, ${specs.tdp}),
            vram_gb = COALESCE(vram_gb, ${specs.vram_gb}),
            specs = COALESCE(specs, '{}'::jsonb) || ${JSON.stringify(specs)}::jsonb
        WHERE id = ${gpu.id}
      `;
      healedCount++;
    }
  }

  // Bulk insert into cache for future reference
  if (cacheInserts.length > 0) {
    // Deduplicate by query_string to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const uniqueCacheInserts = Array.from(
      new Map(cacheInserts.map(item => [item.query_string, item])).values()
    );

    console.log(`💾 Persisting ${uniqueCacheInserts.length} entries to hardware_knowledge_cache...`);
    // Bun.sql bulk insert
    await sql`
      INSERT INTO hardware_knowledge_cache ${sql(uniqueCacheInserts)}
      ON CONFLICT (query_string) DO UPDATE SET resolved_specs = EXCLUDED.resolved_specs
    `;
  }

  console.log(`✅ Global Backfill Complete. Healed ${healedCount} components.`);
  process.exit(0);
}

/**
 * Internal knowledge resolver for GPU specifications.
 * Uses patterns to estimate or provide exact physical specs.
 */
function resolveGpuSpecs(name: string, brand: string) {
  const n = name.toLowerCase();
  const b = brand.toLowerCase();

  let length_mm = 0;
  let tdp = 0;
  let vram_gb = 0;

  // 1. Chipset Base Specs (TDP/VRAM)
  // NVIDIA RTX 50 Series
  if (n.includes('5090')) { tdp = 600; vram_gb = 32; length_mm = 340; }
  else if (n.includes('5080')) { tdp = 400; vram_gb = 16; length_mm = 330; }
  else if (n.includes('5070 ti')) { tdp = 300; vram_gb = 16; length_mm = 300; }
  else if (n.includes('5070')) { tdp = 250; vram_gb = 12; length_mm = 260; }
  else if (n.includes('5060 ti')) { tdp = 180; vram_gb = 16; length_mm = 240; }
  else if (n.includes('5060')) { tdp = 150; vram_gb = 8; length_mm = 220; }
  else if (n.includes('5050')) { tdp = 130; vram_gb = 8; length_mm = 200; }
  // NVIDIA RTX 40 Series
  else if (n.includes('4090')) { tdp = 450; vram_gb = 24; length_mm = 336; }
  else if (n.includes('4080 super')) { tdp = 320; vram_gb = 16; length_mm = 310; }
  else if (n.includes('4080')) { tdp = 320; vram_gb = 16; length_mm = 310; }
  else if (n.includes('4070 ti super')) { tdp = 285; vram_gb = 16; length_mm = 305; }
  else if (n.includes('4070 ti')) { tdp = 285; vram_gb = 12; length_mm = 305; }
  else if (n.includes('4070 super')) { tdp = 220; vram_gb = 12; length_mm = 260; }
  else if (n.includes('4070')) { tdp = 200; vram_gb = 12; length_mm = 260; }
  else if (n.includes('4060 ti')) { tdp = 160; vram_gb = 8; length_mm = 240; }
  else if (n.includes('4060')) { tdp = 115; vram_gb = 8; length_mm = 210; }
  // NVIDIA RTX 30 Series
  else if (n.includes('3090 ti')) { tdp = 450; vram_gb = 24; length_mm = 320; }
  else if (n.includes('3090')) { tdp = 350; vram_gb = 24; length_mm = 310; }
  else if (n.includes('3080 ti')) { tdp = 350; vram_gb = 12; length_mm = 300; }
  else if (n.includes('3080')) { tdp = 320; vram_gb = 10; length_mm = 300; }
  else if (n.includes('3070 ti')) { tdp = 290; vram_gb = 8; length_mm = 280; }
  else if (n.includes('3070')) { tdp = 220; vram_gb = 8; length_mm = 260; }
  else if (n.includes('3060 ti')) { tdp = 200; vram_gb = 8; length_mm = 240; }
  else if (n.includes('3060')) { tdp = 170; vram_gb = 12; length_mm = 240; }
  else if (n.includes('3050')) { tdp = 130; vram_gb = 8; length_mm = 210; }
  // NVIDIA RTX 20 Series
  else if (n.includes('2080 ti')) { tdp = 250; vram_gb = 11; length_mm = 270; }
  else if (n.includes('2080 super')) { tdp = 250; vram_gb = 8; length_mm = 270; }
  else if (n.includes('2080')) { tdp = 215; vram_gb = 8; length_mm = 270; }
  else if (n.includes('2070 super')) { tdp = 215; vram_gb = 8; length_mm = 240; }
  else if (n.includes('2070')) { tdp = 175; vram_gb = 8; length_mm = 240; }
  else if (n.includes('2060 super')) { tdp = 175; vram_gb = 8; length_mm = 240; }
  else if (n.includes('2060')) { tdp = 160; vram_gb = 6; length_mm = 230; }
  // NVIDIA GTX Series
  else if (n.includes('1660 super')) { tdp = 125; vram_gb = 6; length_mm = 200; }
  else if (n.includes('1660 ti')) { tdp = 120; vram_gb = 6; length_mm = 200; }
  else if (n.includes('1660')) { tdp = 120; vram_gb = 6; length_mm = 200; }
  else if (n.includes('1650 super')) { tdp = 100; vram_gb = 4; length_mm = 170; }
  else if (n.includes('1650')) { tdp = 75; vram_gb = 4; length_mm = 170; }
  else if (n.includes('1080 ti')) { tdp = 250; vram_gb = 11; length_mm = 270; }
  else if (n.includes('1080')) { tdp = 180; vram_gb = 8; length_mm = 270; }
  else if (n.includes('1070 ti')) { tdp = 180; vram_gb = 8; length_mm = 270; }
  else if (n.includes('1070')) { tdp = 150; vram_gb = 8; length_mm = 240; }
  else if (n.includes('1060')) { tdp = 120; vram_gb = 6; length_mm = 230; }
  else if (n.includes('1050 ti')) { tdp = 75; vram_gb = 4; length_mm = 160; }
  else if (n.includes('1050')) { tdp = 75; vram_gb = 2; length_mm = 160; }
  // Older/Low End NVIDIA
  else if (n.includes('710')) { tdp = 19; vram_gb = 2; length_mm = 145; }
  else if (n.includes('730')) { tdp = 25; vram_gb = 4; length_mm = 150; }
  else if (n.includes('1030')) { tdp = 30; vram_gb = 2; length_mm = 150; }
  else if (n.includes('6000') && n.includes('well')) { tdp = 300; vram_gb = 96; length_mm = 267; }
  else if (n.includes('rtx 5000') && n.includes('ada')) { tdp = 250; vram_gb = 32; length_mm = 267; }
  else if (n.includes('quadro m4000')) { tdp = 120; vram_gb = 8; length_mm = 241; }
  
  // AMD RX Series
  else if (n.includes('9070 xt')) { tdp = 300; vram_gb = 16; length_mm = 280; }
  else if (n.includes('9070')) { tdp = 220; vram_gb = 12; length_mm = 260; }
  else if (n.includes('9060 xt')) { tdp = 150; vram_gb = 8; length_mm = 240; }
  else if (n.includes('7900 xtx')) { tdp = 355; vram_gb = 24; length_mm = 320; }
  else if (n.includes('7900 gre')) { tdp = 260; vram_gb = 16; length_mm = 280; }
  else if (n.includes('7900 xt')) { tdp = 315; vram_gb = 20; length_mm = 300; }
  else if (n.includes('7800 xt')) { tdp = 263; vram_gb = 16; length_mm = 280; }
  else if (n.includes('7700 xt')) { tdp = 245; vram_gb = 12; length_mm = 270; }
  else if (n.includes('7700')) { tdp = 230; vram_gb = 12; length_mm = 260; }
  else if (n.includes('7600 xt')) { tdp = 190; vram_gb = 16; length_mm = 260; }
  else if (n.includes('7600')) { tdp = 165; vram_gb = 8; length_mm = 240; }
  else if (n.includes('6950 xt')) { tdp = 335; vram_gb = 16; length_mm = 320; }
  else if (n.includes('6900 xt')) { tdp = 300; vram_gb = 16; length_mm = 310; }
  else if (n.includes('6800 xt')) { tdp = 300; vram_gb = 16; length_mm = 300; }
  else if (n.includes('6800')) { tdp = 250; vram_gb = 16; length_mm = 280; }
  else if (n.includes('6750 xt')) { tdp = 250; vram_gb = 12; length_mm = 270; }
  else if (n.includes('6700 xt')) { tdp = 230; vram_gb = 12; length_mm = 270; }
  else if (n.includes('6700')) { tdp = 175; vram_gb = 10; length_mm = 260; }
  else if (n.includes('6650 xt')) { tdp = 180; vram_gb = 8; length_mm = 240; }
  else if (n.includes('6600 xt')) { tdp = 160; vram_gb = 8; length_mm = 240; }
  else if (n.includes('6600')) { tdp = 132; vram_gb = 8; length_mm = 240; }
  else if (n.includes('6500 xt')) { tdp = 107; vram_gb = 4; length_mm = 190; }
  else if (n.includes('6400')) { tdp = 53; vram_gb = 4; length_mm = 170; }
  else if (n.includes('580')) { tdp = 185; vram_gb = 8; length_mm = 240; }
  else if (n.includes('5700 xt')) { tdp = 225; vram_gb = 8; length_mm = 270; }
  else if (n.includes('5500 xt')) { tdp = 130; vram_gb = 8; length_mm = 200; }
  else if (n.includes('550')) { tdp = 50; vram_gb = 4; length_mm = 150; }
  
  // Intel Arc
  else if (n.includes('b580')) { tdp = 190; vram_gb = 12; length_mm = 240; }
  else if (n.includes('b570')) { tdp = 150; vram_gb = 10; length_mm = 220; }
  else if (n.includes('a750')) { tdp = 225; vram_gb = 8; length_mm = 270; }

  // 2. Model Specific Refinements
  if (n.includes('strix') || n.includes('aorus') || n.includes('suprim') || n.includes('trio')) {
    length_mm += 20;
  } else if (n.includes('dual') || n.includes('twin') || n.includes('mech') || n.includes('ventus 2x') || n.includes('pulse')) {
    length_mm = Math.min(length_mm, 260);
  } else if (n.includes('phoenix') || n.includes('aero itx') || n.includes('stormx') || n.includes('pegasus') || n.includes('single fan') || n.includes('itx')) {
    length_mm = 175;
  } else if (n.includes('low profile') || n.includes('lp')) {
    length_mm = 160;
  } else if (n.includes('triple fan') || n.includes('ventus 3x') || n.includes('eagle') || n.includes('windforce')) {
    length_mm = Math.max(length_mm, 285);
  }

  // Final validation
  if (length_mm === 0) return null;

  return {
    length_mm,
    tdp: tdp || null,
    vram_gb: vram_gb || null
  };
}

runBackfill();
