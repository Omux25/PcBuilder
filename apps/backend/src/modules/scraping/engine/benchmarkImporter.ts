/**
 * benchmarkImporter.ts — imports benchmark scores from the JSON data file
 * into the components table using the DNA matcher.
 *
 * Called automatically at the end of each scraping session so that newly
 * created catalog entries get scores without manual intervention.
 *
 * Also callable manually via: bun scripts/tools/import_benchmarks.ts
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSql } from '../../../core/db/index.js';
import { findBestMatch } from '../../../core/utils/componentMatcher.js';

interface BenchmarkEntry {
    name: string;
    score: number;
}

interface BenchmarkData {
    cpu?: BenchmarkEntry[];
    gpu?: BenchmarkEntry[];
}

export interface BenchmarkImportResult {
    updated: number;
    missed: number;
}

/**
 * Reads benchmarks.json and updates benchmark_score for matched components.
 * Uses the DNA matcher at threshold 1.0 (exact match only) to avoid false positives.
 */
export async function importBenchmarks(): Promise<BenchmarkImportResult> {
    const sql = getSql();
    let updated = 0;
    let missed = 0;

    const jsonPath = join(import.meta.dirname, '../../../../scripts/data/benchmarks.json');
    let data: BenchmarkData;
    try {
        data = JSON.parse(await readFile(jsonPath, 'utf-8')) as BenchmarkData;
    } catch {
        return { updated, missed };
    }

    // Load only CPU and GPU components — only categories with benchmark scores
    const components = (await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE category IN ('cpu', 'gpu') AND is_active = true
  `) as { id: number; name: string; brand: string | null; category: string }[];

    const cpus = components.filter(c => c.category === 'cpu');
    const gpus = components.filter(c => c.category === 'gpu');

    async function mapCategory(items: BenchmarkEntry[], catalog: typeof components) {
        const updateRows: { id: number; benchmark_score: number }[] = [];
        
        for (const item of items) {
            const match = findBestMatch(item.name, catalog, 0.9);
            if (match) {
                updateRows.push({ id: match.componentId, benchmark_score: item.score });
                updated++;
            } else {
                missed++;
            }
        }

        if (updateRows.length > 0) {
            // Bulk update using temporary table or json_populate_recordset
            // Bun.sql approach: update in batches to avoid locking the whole table too long
            const BATCH = 100;
            for (let i = 0; i < updateRows.length; i += BATCH) {
                const batch = updateRows.slice(i, i + BATCH);
                await sql`
                    UPDATE components as c
                    SET benchmark_score = b.benchmark_score,
                        updated_at = NOW()
                    FROM (VALUES ${sql(batch.map(r => [r.id, r.benchmark_score]))}) as b(id, benchmark_score)
                    WHERE c.id = b.id::int
                `;
            }
        }
    }

    await mapCategory(data.cpu ?? [], cpus);
    await mapCategory(data.gpu ?? [], gpus);

    return { updated, missed };
}
