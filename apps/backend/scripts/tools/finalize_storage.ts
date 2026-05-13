import { sql } from 'bun';

async function fixStorageGaps() {
    console.log('🚀 Finalizing Storage Data & Categories...\n');

    // 1. Move RAM components to 'ram'
    const ramIds = [3373, 3498, 3090, 3182, 3253];
    await sql`UPDATE components SET category = 'ram' WHERE id IN ${sql(ramIds)}`;
    console.log(`✅ Moved ${ramIds.length} miscategorized RAM modules.`);

    // 2. Move Cooler to 'cooling'
    await sql`UPDATE components SET category = 'cooling' WHERE id = 2782`;
    console.log(`✅ Moved Thermal Grizzly M2 cooler to cooling.`);

    // 3. Move Case Accessory to 'accessory' or 'case' (Antec A400 is a case/fan usually)
    // Wait, Antec A400 is an Air Cooler.
    await sql`UPDATE components SET category = 'cooling' WHERE id = 380`;
    console.log(`✅ Moved Antec A400 to cooling.`);

    // 4. Fix remaining real storage
    // 4499: Datamag 20Gbps (External SSD) -> Interface: USB-C
    await sql`UPDATE components SET capacity_gb = 1000, interface_type = 'USB-C', category = 'external_storage' WHERE id = 4499`;

    // 2400: Twinmos Gx Tornadox7 Pro (SATA SSD)
    await sql`UPDATE components SET capacity_gb = 1000, interface_type = 'SATA' WHERE id = 2400`;

    // 4503: Seagate Portable Expansion 1 To
    await sql`UPDATE components SET capacity_gb = 1000, interface_type = 'USB 3.0', category = 'external_storage' WHERE id = 4503`;

    // 2579: Goodram Px500 PCIe Gen 3 X4 SSD
    await sql`UPDATE components SET interface_type = 'NVMe', capacity_gb = 512 WHERE id = 2579`;

    console.log('\n✨ All critical storage gaps resolved.');
}

await fixStorageGaps();
process.exit(0);
