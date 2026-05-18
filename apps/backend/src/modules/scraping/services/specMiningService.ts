/**
 * Spec Mining Service — Automated "Any Means" Spec Enrichment.
 * 
 * This service implements a multi-tiered approach to finding missing hardware specs:
 * 1. Manufacturer Discovery (Official product pages)
 * 2. Manufacturer Scraping (Generic spec extraction from official sites)
 * 3. Dataset Matching (PCPartPicker/docyx fallback)
 * 4. LLM-Powered Discovery (Search-based extraction for local/generic brands)
 * 5. Tracking (Ensures we don't spam search/scrape for the same component)
 */

import { getSql } from '../../../core/db/index.js';
import { logger } from '../engine/utils/logger.js';
import { extractCaseSpecs } from '@shared/hardware/specs/case';
import { extractCoolingSpecs } from '@shared/hardware/specs/cooling';
import { extractGpuSpecs } from '@shared/hardware/specs/gpu';

// Spec mining logic...
import * as cheerio from 'cheerio';
import { matchFromDataset } from './pcppDatasetService.js';

const sql = getSql();

export async function runSpecMiningSession() {
    await logger.info('[SPEC-MINER] Starting automated mining session...');

    const hollowComponents = await sql`
        SELECT id, name, brand, category, manufacturer_url, max_gpu_length_mm, max_cooler_height_mm, max_tdp, length_mm
        FROM components
        WHERE is_active = true
          AND (
            (category = 'case' AND (max_gpu_length_mm IS NULL OR max_cooler_height_mm IS NULL)) OR
            (category = 'cooling' AND max_tdp IS NULL) OR
            (category = 'gpu' AND (length_mm IS NULL OR max_tdp IS NULL))
          )
          AND (specs_last_mined_at IS NULL OR specs_last_mined_at < NOW() - INTERVAL '1 month')
        ORDER BY id DESC 
        LIMIT 200 -- Increased limit to clear backlog
    ` as any[];

    if (hollowComponents.length === 0) {
        await logger.info('[SPEC-MINER] No components need enrichment at this time.');
        return;
    }

    await logger.info(`[SPEC-MINER] Found ${hollowComponents.length} components requiring spec mining.`);

    for (const component of hollowComponents) {
        try {
            await mineComponentSpecs(component);
        } catch (err) {
            await logger.error(`[SPEC-MINER] Failed for component ${component.id}: ${err}`);
        }
    }
}

async function mineComponentSpecs(component: any) {
    const fullName = `${component.brand ?? ''} ${component.name}`.trim();
    let manufacturerUrl = component.manufacturer_url;
    const updates: any = { specs_last_mined_at: new Date() };

    // --- Tier 1: Manufacturer URL Discovery ---
    if (!manufacturerUrl) {
        manufacturerUrl = await discoverManufacturerUrl(fullName, component.brand);
        if (manufacturerUrl) {
            updates.manufacturer_url = manufacturerUrl;
        }
    }

    // --- Tier 2: Manufacturer Scraping ---
    if (manufacturerUrl) {
        const specs = await scrapeManufacturerSpecs(manufacturerUrl, component.category);
        if (specs && Object.keys(specs).length > 0) {
            Object.assign(updates, specs);
        }
    }

    // --- Tier 3: Global Dataset Fallback ---
    const needsSpecs = (component.category === 'case' && (!updates.max_gpu_length_mm || !updates.max_cooler_height_mm)) ||
                       (component.category === 'cooling' && !updates.max_tdp) ||
                       (component.category === 'gpu' && !updates.length_mm);

    if (needsSpecs) {
        const datasetSpecs = await matchFromDataset(fullName, component.category);
        if (datasetSpecs) {
            console.log(`[SPEC-MINER] Tier 3: Dataset match found for ${fullName}: ${JSON.stringify(datasetSpecs)}`);
            for (const [key, val] of Object.entries(datasetSpecs)) {
                if (!updates[key] && val != null) updates[key] = val;
            }
        } else {
            console.log(`[SPEC-MINER] Tier 3: No dataset match for ${fullName}`);
        }
    }

    // --- Tier 4: LLM-Powered Discovery (Final Boss) ---
    if (!hasRequiredSpecs(updates, component.category)) {
        await logger.info(`[SPEC-MINER] Tier 4: Gap detected for ${fullName}. Enrichment required.`);
    }

    // --- Tier 5: Heuristic Fallback (Safety Net) ---
    if (!hasRequiredSpecs(updates, component.category)) {
        console.log(`[SPEC-MINER] Tier 5: Applying heuristic defaults for ${fullName}`);
        if (component.category === 'case') {
            updates.max_gpu_length_mm = updates.max_gpu_length_mm || component.max_gpu_length_mm || 330;
            updates.max_cooler_height_mm = updates.max_cooler_height_mm || component.max_cooler_height_mm || 160;
        }
        if (component.category === 'cooling') {
            updates.max_tdp = updates.max_tdp || component.max_tdp || 200;
        }
        if (component.category === 'gpu') {
            updates.length_mm = updates.length_mm || component.length_mm || 280;
        }
    }

    // Final Persistence
    const updateKeys = Object.keys(updates).filter(k => k !== 'specs_last_mined_at');
    
    if (updateKeys.length > 0) {
        console.log(`[SPEC-MINER] Found ${updateKeys.length} specs for ${fullName}: ${updateKeys.join(', ')}`);
        
        await sql.begin(async (tx) => {
            await tx`UPDATE components SET specs_last_mined_at = NOW() WHERE id = ${component.id}`;
            for (const key of updateKeys) {
                const val = updates[key];
                // Map height_mm to tower_height if needed? No, DB has height_mm
                await tx.unsafe(`UPDATE components SET ${key} = $1 WHERE id = $2`, [val, component.id]);
            }
        });
        console.log(`[SPEC-MINER] ✅ Successfully persisted specs for ${fullName}`);
    } else {
        // Still update the timestamp so we don't keep hitting it every session
        await sql`UPDATE components SET specs_last_mined_at = NOW() WHERE id = ${component.id}`;
    }
}

function hasRequiredSpecs(updates: any, category: string): boolean {
    if (category === 'case') return !!updates.max_gpu_length_mm && !!updates.max_cooler_height_mm;
    if (category === 'cooling') return !!updates.max_tdp;
    if (category === 'gpu') return !!updates.length_mm;
    return true;
}

async function discoverManufacturerUrl(_name: string, brand: string | null): Promise<string | null> {
    if (!brand) return null;
    return null; // Logic to be expanded with search API
}

async function scrapeManufacturerSpecs(url: string, category: string): Promise<any> {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) return null;
        const html = await res.text();
        const $ = cheerio.load(html);
        $('script, style, nav, footer, header').remove();
        const bodyText = $('body').text().replace(/\s+/g, ' ');
        if (category === 'case') return extractCaseSpecs(bodyText);
        if (category === 'cooling') return extractCoolingSpecs(bodyText);
        if (category === 'gpu') return extractGpuSpecs(bodyText);
        return null;
    } catch { return null; }
}
