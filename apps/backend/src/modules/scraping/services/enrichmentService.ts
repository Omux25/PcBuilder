import { getSql } from '../../../core/db/index.js';
import { logger } from '../engine/utils/logger.js';

const sql = getSql();

/**
 * Tier 1: Smart Inference (Architectural logic)
 * Uses high-performance bulk updates to avoid per-row database round-trips.
 */
export async function runSmartBackfill() {
    await logger.info('[ENRICHMENT] Starting Smart Backfill (Bulk Inference)...');

    // 1. CPU Sockets - Multi-match in a single UPDATE
    const cpuUpdate = await sql`
        UPDATE components 
        SET socket = CASE 
            WHEN name ~* '\\bam4\\b' THEN 'AM4'
            WHEN name ~* '\\bam5\\b' THEN 'AM5'
            WHEN name ~* '\\blga\\s*1700\\b' THEN 'LGA1700'
            WHEN name ~* '\\blga\\s*1851\\b' THEN 'LGA1851'
            WHEN name ~* '\\blga\\s*1200\\b' THEN 'LGA1200'
            WHEN name ~* '\\blga\\s*1151\\b' THEN 'LGA1151'
            ELSE socket
        END
        WHERE category = 'cpu' AND socket IS NULL
          AND name ~* '\\b(am4|am5|lga\\s*1700|lga\\s*1851|lga\\s*1200|lga\\s*1151)\\b'
    ` as any;
    if (cpuUpdate.count > 0) await logger.info(`[ENRICHMENT] Smart: Inferred socket for ${cpuUpdate.count} CPUs`);

    // 2. Motherboard M.2 Slots
    const mbUpdate = await sql`
        UPDATE components SET m2_slots = 
            CASE 
                WHEN name ~* '(Z790|Z690|X670|X870|X570)' THEN 3
                WHEN name ~* '(B760|B660|B650|B550|H770|H670)' THEN 2
                ELSE 1
            END
        WHERE category = 'motherboard' AND m2_slots IS NULL
          AND name ~* '(Z790|Z690|X670|X870|X570|B760|B660|B650|B550|H770|H670)'
    ` as any;
    if (mbUpdate.count > 0) await logger.info(`[ENRICHMENT] Smart: Inferred M.2 slots for ${mbUpdate.count} motherboards`);

    // 3. Case Compatibility
    const caseUpdate = await sql`
        UPDATE components SET supported_motherboards = 
            CASE 
                WHEN name ~* '(ATX|Full Tower|Middle Tower|Moyenne Tour)' THEN ARRAY['ATX', 'mATX', 'Mini-ITX']
                WHEN name ~* '(mATX|Micro ATX|Micro-ATX)' THEN ARRAY['mATX', 'Mini-ITX']
                WHEN name ~* '(Mini-ITX|Mini ITX)' THEN ARRAY['Mini-ITX']
                WHEN name ~* '(E-ATX|Eatx)' THEN ARRAY['E-ATX', 'ATX', 'mATX', 'Mini-ITX']
                ELSE supported_motherboards
            END
        WHERE category = 'case' AND supported_motherboards IS NULL
          AND name ~* '(ATX|Tower|Tour|Mini-ITX|Mini ITX|mATX|Micro ATX|Micro-ATX)'
    ` as any;
    if (caseUpdate.count > 0) await logger.info(`[ENRICHMENT] Smart: Inferred motherboard support for ${caseUpdate.count} cases`);

    // 4. Storage Capacity (Normalization)
    const storageUpdate = await sql`
        UPDATE components SET capacity_gb = 
            CASE 
                WHEN name ~* '([0-9]+)\\s*(TB|TO)' THEN (substring(UPPER(name) from '([0-9]+)\\s*(TB|TO)')::int * 1024)
                WHEN name ~* '([0-9]+)\\s*(GB|Go)' THEN substring(UPPER(name) from '([0-9]+)\\s*(GB|GO)')::int
                ELSE capacity_gb
            END
        WHERE category = 'storage' AND capacity_gb IS NULL
          AND name ~* '[0-9]+\\s*(GB|Go|TB|TO)'
    ` as any;
    if (storageUpdate.count > 0) await logger.info(`[ENRICHMENT] Smart: Normalized capacity for ${storageUpdate.count} storage devices`);
}
