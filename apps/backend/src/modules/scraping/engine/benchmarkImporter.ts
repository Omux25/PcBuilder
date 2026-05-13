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

    const jsonPath = join(import.meta.dirname, '../../../../../scripts/data/benchmarks.json');
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
        for (const item of items) {
            const match = findBestMatch(item.name, catalog, 0.9);
            if (match) {
                await sql`
          UPDATE components
          SET benchmark_score = ${item.score}
          WHERE id = ${match.componentId}
            AND (benchmark_score IS NULL OR benchmark_score != ${item.score})
        `;
                updated++;
            } else {
                missed++;
            }
        }
    }

    await mapCategory(data.cpu ?? [], cpus);
    await mapCategory(data.gpu ?? [], gpus);

    return { updated, missed };
}
