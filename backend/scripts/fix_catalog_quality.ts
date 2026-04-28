/**
 * fix_catalog_quality.ts
 * 1. Update CPUs missing socket using the fixed extractCpuSpecs
 * 2. Update GPUs missing length_mm using the fixed extractGpuSpecs
 * 3. Remove duplicate components (keep lowest id, remap mappings/prices)
 */
import { sql } from 'bun';

// Import the fixed extractors from catalogBuilder
// We re-implement them inline here to avoid circular imports

function extractCpuSocket(name: string): string | null {
  const n = name.toLowerCase();
  const modelMatch = n.match(/\b(\d{4,5}[a-z0-9]{0,4})\b/);
  const modelNum = modelMatch ? parseInt(modelMatch[1]) : 0;

  if (n.match(/\bryzen/)) {
    return modelNum >= 7000 ? 'AM5' : 'AM4';
  }
  if (n.match(/\b(athlon|a[468]\d{3}g?)\b/)) return 'AM4';
  if (n.match(/\bcore\s*ultra/)) return 'LGA1851';
  if (n.match(/\bcore\s*i[3579]/)) {
    if (modelNum >= 12000) return 'LGA1700';
    if (modelNum >= 10000) return 'LGA1200';
    if (modelNum >= 8000)  return 'LGA1151';
    return 'LGA1700';
  }
  if (n.match(/\b(pentium|celeron)\b/)) return 'LGA1200';
  if (n.match(/\bthreadripper/)) return 'TRX40';
  return null;
}

function extractGpuLength(name: string): number {
  const n = name.toLowerCase();
  let tdp = 150;
  if      (n.match(/\brtx\s*5090\b/))         tdp = 575;
  else if (n.match(/\brtx\s*5080\b/))         tdp = 360;
  else if (n.match(/\brtx\s*4090\b/))         tdp = 450;
  else if (n.match(/\brtx\s*4080\b/))         tdp = 320;
  else if (n.match(/\brtx\s*4070\s*ti\b/))    tdp = 285;
  else if (n.match(/\brtx\s*4070\b/))         tdp = 200;
  else if (n.match(/\brtx\s*3090\b/))         tdp = 350;
  else if (n.match(/\brtx\s*3080\b/))         tdp = 320;
  else if (n.match(/\brtx\s*3070\b/))         tdp = 220;
  else if (n.match(/\brtx\s*3060\b/))         tdp = 170;
  else if (n.match(/\brtx\s*2080\b/))         tdp = 215;
  else if (n.match(/\brtx\s*2070\b/))         tdp = 175;
  else if (n.match(/\brtx\s*2060\b/))         tdp = 160;
  else if (n.match(/\bgtx\s*1660\b/))         tdp = 120;
  else if (n.match(/\bgtx\s*1650\b/))         tdp = 75;
  else if (n.match(/\bgtx\s*1080\b/))         tdp = 180;
  else if (n.match(/\bgtx\s*1070\b/))         tdp = 150;
  else if (n.match(/\bgtx\s*1060\b/))         tdp = 120;
  else if (n.match(/\bgtx\s*1050\b/))         tdp = 75;
  else if (n.match(/\brx\s*9070\s*xt\b/))     tdp = 304;
  else if (n.match(/\brx\s*9070\b/))          tdp = 220;
  else if (n.match(/\brx\s*9060\s*xt\b/))     tdp = 150;
  else if (n.match(/\brx\s*7900\s*xtx\b/))    tdp = 355;
  else if (n.match(/\brx\s*7900\b/))          tdp = 315;
  else if (n.match(/\brx\s*7800\s*xt\b/))     tdp = 263;
  else if (n.match(/\brx\s*6950\s*xt\b/))     tdp = 335;
  else if (n.match(/\brx\s*6900\s*xt\b/))     tdp = 300;
  else if (n.match(/\brx\s*6800\b/))          tdp = 250;
  else if (n.match(/\brx\s*6700\s*xt\b/))     tdp = 230;
  else if (n.match(/\brx\s*6700\b/))          tdp = 175;
  else if (n.match(/\brx\s*6650\s*xt\b/))     tdp = 180;
  else if (n.match(/\brx\s*6600\b/))          tdp = 132;
  else if (n.match(/\brx\s*6400\b/))          tdp = 53;
  else if (n.match(/\brx\s*5700\s*xt\b/))     tdp = 225;
  else if (n.match(/\brx\s*5700\b/))          tdp = 180;
  else if (n.match(/\brx\s*5500\s*xt\b/))     tdp = 130;
  else if (n.match(/\barc\s*b580\b/))         tdp = 190;
  else if (n.match(/\barc\s*b570\b/))         tdp = 150;
  else if (n.match(/\barc\s*a770\b/))         tdp = 225;

  if      (tdp >= 400) return 360;
  else if (tdp >= 300) return 336;
  else if (tdp >= 200) return 285;
  else if (tdp >= 130) return 240;
  else                 return 200;
}

// ── 1. Fix CPUs missing socket ────────────────────────────────────────────────
console.log('\n=== Fixing CPUs missing socket ===');
const cpuNoSocket = await sql`
  SELECT id, name, brand FROM components
  WHERE category = 'cpu' AND is_active = true
    AND (socket IS NULL OR socket = '')
` as { id: number; name: string; brand: string }[];

let cpuFixed = 0, cpuSkipped = 0;
for (const c of cpuNoSocket) {
  const socket = extractCpuSocket(`${c.brand ?? ''} ${c.name}`);
  if (socket) {
    await sql`UPDATE components SET socket = ${socket} WHERE id = ${c.id}`;
    cpuFixed++;
  } else {
    console.log(`  Cannot determine socket for: ${c.brand} ${c.name}`);
    cpuSkipped++;
  }
}
console.log(`Fixed: ${cpuFixed}, skipped: ${cpuSkipped}`);

// ── 2. Fix GPUs missing length_mm ─────────────────────────────────────────────
console.log('\n=== Fixing GPUs missing length_mm ===');
const gpuNoLength = await sql`
  SELECT id, name, brand FROM components
  WHERE category = 'gpu' AND is_active = true
    AND (length_mm IS NULL OR length_mm = 0)
` as { id: number; name: string; brand: string }[];

let gpuFixed = 0;
for (const c of gpuNoLength) {
  const length_mm = extractGpuLength(`${c.brand ?? ''} ${c.name}`);
  await sql`UPDATE components SET length_mm = ${length_mm} WHERE id = ${c.id}`;
  gpuFixed++;
}
console.log(`Fixed: ${gpuFixed}`);

// ── 3. Remove duplicates ──────────────────────────────────────────────────────
console.log('\n=== Removing duplicate components ===');
const dupes = await sql`
  SELECT brand, name, COUNT(*) as cnt, array_agg(id ORDER BY id) as ids
  FROM components
  WHERE is_active = true
  GROUP BY brand, name
  HAVING COUNT(*) > 1
  ORDER BY cnt DESC
` as { brand: string; name: string; cnt: number; ids: number[] }[];

let dupeFixed = 0;
for (const d of dupes) {
  const keepId = d.ids[0]; // keep lowest id
  const removeIds = d.ids.slice(1);

  for (const removeId of removeIds) {
    // Remap scraper_mappings to the kept id
    await sql`
      UPDATE scraper_mappings SET component_id = ${keepId}
      WHERE component_id = ${removeId}
    `;
    // Remap prices
    await sql`
      UPDATE prices SET component_id = ${keepId}
      WHERE component_id = ${removeId}
    `;
    // Remap price_history
    await sql`
      UPDATE price_history SET component_id = ${keepId}
      WHERE component_id = ${removeId}
    `;
    // Remap unmatched_listings
    await sql`
      UPDATE unmatched_listings SET linked_component_id = ${keepId}
      WHERE linked_component_id = ${removeId}
    `;
    // Deactivate the duplicate
    await sql`UPDATE components SET is_active = false WHERE id = ${removeId}`;
    dupeFixed++;
  }
  console.log(`  Merged ${d.cnt}x "${d.brand} ${d.name}" → kept id ${keepId}`);
}
console.log(`Duplicates removed: ${dupeFixed}`);

process.exit(0);
