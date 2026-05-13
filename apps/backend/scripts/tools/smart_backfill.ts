import { sql } from 'bun';

function norm(s: string) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }

async function backfillCpuSockets() {
    const rows = await sql`SELECT id, name FROM components WHERE category = 'cpu' AND socket IS NULL` as { id: number; name: string }[];
    let updated = 0;
    for (const { id, name } of rows) {
        const n = norm(name);
        let socket: string | null = null;
        
        // Direct mention
        if (/\bam4\b/.test(n)) socket = 'AM4';
        else if (/\bam5\b/.test(n)) socket = 'AM5';
        else if (/\blga\s*1700\b/.test(n)) socket = 'LGA1700';
        else if (/\blga\s*1200\b/.test(n)) socket = 'LGA1200';
        else if (/\blga\s*1151\b/.test(n)) socket = 'LGA1151';
        else if (/\blga\s*1851\b/.test(n)) socket = 'LGA1851';
        else if (/\btr4\b/.test(n)) socket = 'TR4';
        else if (/\bstrx4\b/.test(n)) socket = 'sTRX4';
        
        // Model based inference
        if (!socket) {
            // Ryzen
            if (/\b(7|8|9)\d{3}[gx]?\b/.test(n)) socket = 'AM5'; // Ryzen 7000/8000/9000
            else if (/\b(1|2|3|4|5)\d{3}[gx]?\b/.test(n)) socket = 'AM4'; // Ryzen 1000-5000
            // Intel
            else if (/\b1[234]\d{3,4}[a-z]{0,3}\b/.test(n)) socket = 'LGA1700'; // Intel 12th-14th
            else if (/\b1[01]\d{3,4}[a-z]{0,3}\b/.test(n)) socket = 'LGA1200'; // Intel 10th-11th
            else if (/\b[6789]\d{3}[a-z]{0,3}\b/.test(n)) socket = 'LGA1151'; // Intel 6th-9th
        }
        
        if (socket) {
            await sql`UPDATE components SET socket = ${socket} WHERE id = ${id}`;
            updated++;
        }
    }
    console.log(`CPU Sockets: ${updated}/${rows.length} updated`);
}

async function backfillMotherboardSpecs() {
    const rows = await sql`SELECT id, name FROM components WHERE category = 'motherboard' AND (socket IS NULL OR chipset IS NULL OR form_factor IS NULL)` as { id: number; name: string }[];
    let updated = 0;
    for (const { id, name } of rows) {
        const n = norm(name);
        let socket: string | null = null;
        let chipset: string | null = null;
        let form_factor: string | null = null;

        // Chipset
        const chipsetMatch = n.match(/\b([abxhz]\d{3}[eimdpqrsv]?)\b/i) || 
                            n.match(/\b(trx\d{2}|wrx\d{2})\b/i);
        if (chipsetMatch) {
            chipset = chipsetMatch[1].toUpperCase();
            
            // Infer socket from chipset
            if (/\b(B650|X670|A620|B850|X870)\b/i.test(chipset)) socket = 'AM5';
            else if (/\b(B450|B550|X570|A320|A520)\b/i.test(chipset)) socket = 'AM4';
            else if (/\b(H610|B660|B760|H770|Z690|Z790)\b/i.test(chipset)) socket = 'LGA1700';
            else if (/\b(H410|B460|H510|B560|Z490|Z590)\b/i.test(chipset)) socket = 'LGA1200';
            else if (/\b(H310|B360|B365|Z370|Z390)\b/i.test(chipset)) socket = 'LGA1151';
            else if (/\b(TRX40|TRX50)\b/i.test(chipset)) socket = 'sTRX4';
            else if (/\b(WRX80|WRX90)\b/i.test(chipset)) socket = 'sWRX8';
        }

        // Form Factor
        if (/\b(itx|mini-itx)\b/i.test(n)) form_factor = 'Mini-ITX';
        else if (/\b(m-atx|matx|micro-atx|h610m|b760m|b650m|b550m|a520m)\b/i.test(n)) form_factor = 'mATX';
        else if (/\b(atx)\b/i.test(n)) form_factor = 'ATX';
        else if (/\b(e-atx|eatx)\b/i.test(n)) form_factor = 'E-ATX';

        if (socket || chipset || form_factor) {
            await sql`
                UPDATE components SET 
                    socket = COALESCE(socket, ${socket}),
                    chipset = COALESCE(chipset, ${chipset}),
                    form_factor = COALESCE(form_factor, ${form_factor})
                WHERE id = ${id}
            `;
            updated++;
        }
    }
    console.log(`Motherboard Specs: ${updated}/${rows.length} updated`);
}

async function backfillFanSpecs() {
    const rows = await sql`SELECT id, name FROM components WHERE category = 'fan' AND size_mm IS NULL` as { id: number; name: string }[];
    let updated = 0;
    for (const { id, name } of rows) {
        const n = norm(name);
        let size_mm: number | null = null;
        
        if (/\b120\s*mm\b/.test(n) || /\b120\b/.test(n)) size_mm = 120;
        else if (/\b140\s*mm\b/.test(n) || /\b140\b/.test(n)) size_mm = 140;
        else if (/\b80\s*mm\b/.test(n) || /\b80\b/.test(n)) size_mm = 80;
        else if (/\b92\s*mm\b/.test(n) || /\b92\b/.test(n)) size_mm = 92;
        else if (/\b200\s*mm\b/.test(n) || /\b200\b/.test(n)) size_mm = 200;
        
        if (size_mm) {
            await sql`UPDATE components SET size_mm = ${size_mm} WHERE id = ${id}`;
            updated++;
        }
    }
    console.log(`Fan Specs: ${updated}/${rows.length} updated`);
}

async function backfillStorageSpeeds() {
    const rows = await sql`SELECT id, name FROM components WHERE category = 'storage' AND (read_speed_mbps IS NULL OR write_speed_mbps IS NULL)` as { id: number; name: string }[];
    let updated = 0;
    for (const { id, name } of rows) {
        const n = norm(name);
        let read: number | null = null;
        let write: number | null = null;
        
        const readMatch = n.match(/(\d{3,5})\s*(?:mb|mo)\/s/i);
        if (readMatch) read = parseInt(readMatch[1]);

        if (!read) {
            if (/\b990\s*pro\b/i.test(n)) { read = 7450; write = 6900; }
            else if (/\b980\s*pro\b/i.test(n)) { read = 7000; write = 5000; }
            else if (/\b980\b/i.test(n)) { read = 3500; write = 3000; }
            else if (/\b970\s*evo\s*plus\b/i.test(n)) { read = 3500; write = 3300; }
            else if (/\bp3\s*plus\b/i.test(n)) { read = 5000; write = 4200; }
            else if (/\bp3\b/i.test(n)) { read = 3500; write = 3000; }
            else if (/\bnv2\b/i.test(n)) { read = 3500; write = 2100; }
            else if (/\bsn850x\b/i.test(n)) { read = 7300; write = 6300; }
            else if (/\bsn770\b/i.test(n)) { read = 5150; write = 4850; }
            else if (/\baorus\s*gen4\s*7000s\b/i.test(n)) { read = 7000; write = 6850; }
            else if (/\ba400\b/i.test(n)) { read = 500; write = 450; }
        }
        
        if (read || write) {
            await sql`
                UPDATE components SET 
                    read_speed_mbps = COALESCE(read_speed_mbps, ${read}),
                    write_speed_mbps = COALESCE(write_speed_mbps, ${write})
                WHERE id = ${id}
            `;
            updated++;
        }
    }
    console.log(`Storage Speeds: ${updated}/${rows.length} updated`);
}

async function backfillMotherboardM2() {
    const rows = await sql`SELECT id, chipset FROM components WHERE category = 'motherboard' AND m2_slots IS NULL` as { id: number; chipset: string | null }[];
    let updated = 0;
    for (const { id, chipset } of rows) {
        if (!chipset) continue;
        let m2 = 1;
        if (/\b(Z790|Z690|X670|X870|X570)\b/i.test(chipset)) m2 = 3;
        else if (/\b(B760|B660|B650|B550|H770|H670)\b/i.test(chipset)) m2 = 2;
        else m2 = 1;
        await sql`UPDATE components SET m2_slots = ${m2} WHERE id = ${id}`;
        updated++;
    }
    console.log(`Motherboard M.2: ${updated}/${rows.length} updated`);
}

async function backfillRamSpecs() {
    const rows = await sql`SELECT id, name FROM components WHERE category = 'ram' AND (cas_latency IS NULL OR kit_count IS NULL)` as { id: number; name: string }[];
    let updated = 0;
    for (const { id, name } of rows) {
        const n = norm(name);
        let cas_latency: number | null = null;
        let kit_count: number | null = null;
        
        // CAS Latency: C16, CL18, CL 30, etc.
        const clMatch = n.match(/\bcl\s*(\d{2})\b/i) || n.match(/\bc(\d{2})\b/i);
        if (clMatch) cas_latency = parseInt(clMatch[1]);
        
        // Kit Count: 2x8GB, 1x16GB, 2 * 16
        const kitMatch = n.match(/\b(\d+)\s*[x\*]\s*\d+\b/i);
        if (kitMatch) kit_count = parseInt(kitMatch[1]);
        else if (/\bkit\s*de\s*2\b/i.test(n)) kit_count = 2;
        else if (/\bdual\s*channel\b/i.test(n)) kit_count = 2;
        else if (/\bsingle\s*module\b/i.test(n)) kit_count = 1;
        
        if (cas_latency || kit_count) {
            await sql`
                UPDATE components SET 
                    cas_latency = COALESCE(cas_latency, ${cas_latency}),
                    kit_count = COALESCE(kit_count, ${kit_count})
                WHERE id = ${id}
            `;
            updated++;
        }
    }
    console.log(`RAM Specs: ${updated}/${rows.length} updated`);
}

async function backfillCaseCompatibility() {
    const rows = await sql`SELECT id, name, form_factor FROM components WHERE category = 'case' AND supported_motherboards IS NULL` as { id: number; name: string; form_factor: string | null }[];
    let updated = 0;
    for (const { id, name, form_factor } of rows) {
        let supported: string[] = [];
        const n = norm(name);
        const ff = form_factor || '';
        
        if (ff === 'ATX' || ff === 'Full Tower' || /\batx\b/i.test(n)) {
            supported = ['ATX', 'mATX', 'Mini-ITX'];
        } else if (ff === 'mATX' || /\b(matx|micro-atx)\b/i.test(n)) {
            supported = ['mATX', 'Mini-ITX'];
        } else if (ff === 'Mini-ITX' || /\b(itx|mini-itx)\b/i.test(n)) {
            supported = ['Mini-ITX'];
        } else if (ff === 'E-ATX' || /\beatx\b/i.test(n)) {
            supported = ['E-ATX', 'ATX', 'mATX', 'Mini-ITX'];
        }
        
        if (supported.length > 0) {
            const pgArray = '{' + supported.map(s => `"${s}"`).join(',') + '}';
            await sql`UPDATE components SET supported_motherboards = ${pgArray}::text[] WHERE id = ${id}`;
            updated++;
        }
    }
    console.log(`Case Compatibility: ${updated}/${rows.length} updated`);
}

async function backfillCoolingSockets() {
    // Most modern coolers support almost everything. 
    // If it's a recent cooler, we can safely assume LGA1700/AM4/AM5.
    const rows = await sql`SELECT id, name, tags FROM components WHERE category = 'cooling' AND supported_sockets IS NULL` as { id: number; name: string; tags: string[] | null }[];
    let updated = 0;
    const commonSockets = ['LGA1700', 'LGA1200', 'LGA1151', 'AM4', 'AM5'];
    
    for (const { id, name, tags } of rows) {
        const n = norm(name);
        let sockets = [...commonSockets];
        
        // TR4/sTRX4 usually only for specific coolers
        if (/\b(tr4|threadripper)\b/i.test(n)) sockets.push('TR4', 'sTRX4');
        
        const pgArray = '{' + sockets.map(s => `"${s}"`).join(',') + '}';
        await sql`UPDATE components SET supported_sockets = ${pgArray}::text[] WHERE id = ${id}`;
        updated++;
    }
    console.log(`Cooling Sockets: ${updated}/${rows.length} updated`);
}

async function backfillThreadCount() {
    const rows = await sql`SELECT id, name, core_count FROM components WHERE category = 'cpu' AND thread_count IS NULL AND core_count IS NOT NULL` as { id: number; name: string; core_count: number }[];
    let updated = 0;
    for (const { id, name, core_count } of rows) {
        const n = norm(name);
        let thread_count: number | null = null;
        
        // Ryzen 1000-5000: threads = 2 * cores
        if (/\b(1|2|3|4|5)\d{3}[gx]?\b/.test(n)) {
            thread_count = 2 * core_count;
        }
        // Intel 10th-11th: threads = 2 * cores
        else if (/\b1[01]\d{3}[kfq]?\b/.test(n)) {
            thread_count = 2 * core_count;
        }
        // Intel 12th-14th: more complex, but we can hardcode common ones
        else if (/\b12400[f]?\b/i.test(n)) thread_count = 12; // 6P + 0E
        else if (/\b12600k\b/i.test(n)) thread_count = 16; // 6P + 4E
        else if (/\b12700k\b/i.test(n)) thread_count = 20; // 8P + 4E
        else if (/\b12900k\b/i.test(n)) thread_count = 24; // 8P + 8E
        else if (/\b13400[f]?\b/i.test(n)) thread_count = 16; // 6P + 4E
        else if (/\b13600k\b/i.test(n)) thread_count = 20; // 6P + 8E
        else if (/\b13700k\b/i.test(n)) thread_count = 24; // 8P + 8E
        else if (/\b13900k\b/i.test(n)) thread_count = 32; // 8P + 16E
        else if (/\b14400[f]?\b/i.test(n)) thread_count = 16; // 6P + 4E
        else if (/\b14600k\b/i.test(n)) thread_count = 20; // 6P + 8E
        else if (/\b14700k\b/i.test(n)) thread_count = 28; // 8P + 12E
        else if (/\b14900k\b/i.test(n)) thread_count = 32; // 8P + 16E
        
        if (thread_count) {
            await sql`UPDATE components SET thread_count = ${thread_count} WHERE id = ${id}`;
            updated++;
        }
    }
    console.log(`Thread Count: ${updated}/${rows.length} updated`);
}

console.log('Starting smart backfill...\n');
await backfillCpuSockets();
await backfillMotherboardSpecs();
await backfillMotherboardM2();
await backfillFanSpecs();
await backfillStorageSpeeds();
await backfillRamSpecs();
await backfillCaseCompatibility();
await backfillCoolingSockets();
await backfillThreadCount();
console.log('\nSmart backfill complete.');
process.exit(0);
