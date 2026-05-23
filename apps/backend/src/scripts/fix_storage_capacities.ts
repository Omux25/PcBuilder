import { getSql } from '../core/db/index.js';

async function main() {
  const sql = getSql();

  // Find storage components with capacity_gb >= 100000
  const corrupted = await sql`
    SELECT id, name, brand, capacity_gb FROM components
    WHERE category = 'storage' AND capacity_gb >= 100000
  ` as { id: number, name: string, brand: string | null, capacity_gb: number }[];

  console.log(`Found ${corrupted.length} corrupted storage components with capacity >= 100000 GB:\n`);
  for (const comp of corrupted) {
    console.log(`ID: ${comp.id} | Brand: ${comp.brand} | Name: "${comp.name}" | Capacity: ${comp.capacity_gb} GB`);
  }

  console.log('\nStarting database remediation...');

  // Update them
  for (const comp of corrupted) {
    const correctedCap = comp.capacity_gb / 1000;
    
    // We also want to fix the name if it contains "TB" or "To" due to the factor of 1000 error.
    // E.g., if correctedCap is 240, and the name has "240TB", replace with "240GB".
    // If correctedCap is 2000 (which is 2TB), and name has "2000TB", replace with "2TB" or "2000GB".
    // Let's replace the string dynamically.
    let newName = comp.name;
    const oldCapTB = comp.capacity_gb / 1000; // e.g. 240 or 2000
    
    // Replace e.g., "240TB" or "240TB" with the correct capacity name
    const tbRegex = new RegExp(`\\b${oldCapTB}\\s*(?:TB|To)\\b`, 'gi');
    if (tbRegex.test(newName)) {
      if (correctedCap >= 1000) {
        newName = newName.replace(tbRegex, `${correctedCap / 1000}TB`);
      } else {
        newName = newName.replace(tbRegex, `${correctedCap}GB`);
      }
    } else {
      // General backup replacement
      newName = newName
        .replace(/\b(\d+)\s*(?:TB|To)\b/gi, (match, valStr) => {
          const val = parseInt(valStr);
          if (val === oldCapTB) {
            return correctedCap >= 1000 ? `${correctedCap / 1000}TB` : `${correctedCap}GB`;
          }
          return match;
        });
    }

    console.log(`Fixing ID ${comp.id}: "${comp.name}" -> "${newName}" | Capacity: ${comp.capacity_gb} GB -> ${correctedCap} GB`);
    
    await sql`
      UPDATE components
      SET capacity_gb = ${correctedCap}, name = ${newName}, updated_at = NOW()
      WHERE id = ${comp.id}
    `;
  }

  // Also correct MSI Datamag 20Gbps (ID 2523) capacity to 1000 GB
  const datamag = await sql`
    SELECT id, name, brand, capacity_gb FROM components WHERE id = 2523
  ` as { id: number, name: string, brand: string | null, capacity_gb: number | null }[];

  if (datamag.length > 0) {
    const comp = datamag[0];
    console.log(`\nChecking MSI Datamag (ID 2523): "${comp.name}" | Current capacity: ${comp.capacity_gb} GB`);
    if (comp.capacity_gb !== 1000) {
      console.log(`Fixing MSI Datamag ID 2523 capacity to 1000 GB`);
      await sql`
        UPDATE components
        SET capacity_gb = 1000, updated_at = NOW()
        WHERE id = 2523
      `;
    }
  } else {
    console.log('\nMSI Datamag (ID 2523) not found in DB.');
  }

  console.log('\nRemediation complete.');
}

main().catch(console.error);
