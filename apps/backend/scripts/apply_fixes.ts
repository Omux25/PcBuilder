import { getSql } from '../src/core/db/index';
import { inferCategory } from '@shared/component-utils';

async function applyFixes() {
  console.log("--- Applying Comprehensive Database Integrity Fixes (V2) ---");

  const sql = getSql();

  // 1. Dismiss suspected builds from unmatched_listings
  console.log("Identifying full PC builds in unmatched listings...");
  const pending = await sql`SELECT id, scraped_name FROM unmatched_listings WHERE status = 'pending'` as any[];
  
  let listingDismissed = 0;
  for (const p of pending) {
    if (inferCategory(p.scraped_name) === 'build') {
      await sql`UPDATE unmatched_listings SET status = 'dismissed' WHERE id = ${p.id}`;
      listingDismissed++;
    }
  }
  console.log(`Dismissed ${listingDismissed} suspected builds from unmatched listings.`);

  // 2. Audit components catalog for category mismatches and builds
  console.log("Auditing components catalog for category mismatches and builds...");
  
  // Latest signals (re-implemented here for safety/transparency in script)
  const cpuSignals = [/\bryzen/i, /\bcore\s+i/i, /\bcore\s+ultra/i, /\bthreadripper/i, /\bxeon\b/i, /\bi[3579]-\d/i, /\b[ri][3579]\b/i];
  const gpuSignals = [/\brtx/i, /\bgtx/i, /\bradeon/i, /\brx\s*\d/i, /\bquadro\b/i, /\bfirepro\b/i, /\bpro\s*(6|5)000\b/i, /\bvega\b/i, /\biris\b/i, /\buhd\s*graphics\b/i, /\bgt\s*\d{3}/i];
  const buildSignals = [/\b(workstation|station\s*de\s*travail|pc\s*professionnel)\b/i];

  const components = await sql`SELECT id, name, category, is_active FROM components` as any[];
  
  let caseFixed = 0;
  let buildsDeactivated = 0;
  let ssdFixed = 0;
  let fansFixed = 0;
  let othersFixed = 0;

  for (const c of components) {
    const name = c.name.toLowerCase();
    const inferred = inferCategory(c.name);

    // A. Build detection (Highest Priority)
    const hasCpu = cpuSignals.some(r => r.test(name));
    const hasGpu = gpuSignals.some(r => r.test(name));
    const isWorkstation = buildSignals.some(r => r.test(name)) && hasCpu;
    const isBuild = (hasCpu && hasGpu) || isWorkstation || inferred === 'build';

    if (isBuild || inferred === 'bundle') {
      if (c.is_active) {
        console.log(`Deactivating bundle/build found in components ${c.id}: "${c.name}"`);
        await sql`UPDATE components SET is_active = false WHERE id = ${c.id}`;
        buildsDeactivated++;
      }
      continue;
    }

    // B. Specific category bleeds
    
    // 1. Storage in RAM
    if (c.category === 'ram' && (/\b(\d+)\s*(tb|to)\b/i.test(name) || name.includes('960gb') || name.includes('ssd') || name.includes('nvme'))) {
      if (!name.includes('ddr') && !name.includes('mhz')) {
        console.log(`Fixing RAM -> Storage for ${c.id}: "${c.name}"`);
        await sql`UPDATE components SET category = 'storage' WHERE id = ${c.id}`;
        ssdFixed++;
        continue;
      }
    }

    // 2. Fans in PSU (Triple pack, etc.)
    if (c.category === 'psu' && (name.includes('pack') || name.includes('ventilateur') || name.includes('fan')) && !name.includes('w')) {
      console.log(`Fixing PSU -> Fan for ${c.id}: "${c.name}"`);
      await sql`UPDATE components SET category = 'fan' WHERE id = ${c.id}`;
      fansFixed++;
      continue;
    }

    // 3. General category inference re-run (Exhaustive)
    if (inferred && inferred !== c.category && inferred !== 'build') {
        console.log(`Auto-correcting category for ${c.id}: "${c.name}" (${c.category} -> ${inferred})`);
        await sql`UPDATE components SET category = ${inferred} WHERE id = ${c.id}`;
        othersFixed++;
    }
  }
  
  console.log("--- Summary of Actions ---");
  console.log(`Builds deactivated: ${buildsDeactivated}`);
  console.log(`RAM -> Storage fixes: ${ssdFixed}`);
  console.log(`PSU -> Fan fixes: ${fansFixed}`);
  console.log(`General category fixes: ${othersFixed}`);
  console.log("--- Fixes Applied Successfully ---");
}

applyFixes().catch(console.error).finally(() => process.exit());
