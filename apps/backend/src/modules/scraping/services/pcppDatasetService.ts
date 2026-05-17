/**
 * PCPartPicker Dataset Service — Manages the global hardware dataset.
 * 
 * Logic ported from scripts/enrich_from_pcpartpicker.ts.
 */

import { getSql } from '../../../core/db/index.js';
import { logger } from '../engine/utils/logger.js';

const sql = getSql();

const BASE = 'https://raw.githubusercontent.com/docyx/pc-part-dataset/main/data/json';

const DATASETS = {
    cpu: `${BASE}/cpu.json`,
    gpu: `${BASE}/video-card.json`,
    motherboard: `${BASE}/motherboard.json`,
    cooler: `${BASE}/cpu-cooler.json`,
    case: `${BASE}/case.json`,
    psu: `${BASE}/power-supply.json`,
    ram: `${BASE}/memory.json`,
    storage: `${BASE}/internal-hard-drive.json`,
};

let datasetCache: Record<string, any[]> = {};

function norm(s: string): string {
    return s.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenOverlap(reference: string, candidate: string): number {
    const refTokens = norm(reference).split(' ').filter(t => t.length > 1);
    const candNorm = norm(candidate);
    if (refTokens.length === 0) return 0;
    const matched = refTokens.filter(t => candNorm.includes(t));
    return matched.length / refTokens.length;
}

function findBest<T extends { name: string }>(
    catalogName: string,
    dataset: T[],
    minScore = 0.6,
): T | null {
    let best: T | null = null;
    let bestScore = 0;

    for (const item of dataset) {
        const score = tokenOverlap(catalogName, item.name);
        if (score > bestScore) {
            bestScore = score;
            best = item;
        }
    }
    return bestScore >= minScore ? best : null;
}

export async function matchFromDataset(name: string, category: string): Promise<any> {
    const datasetKey = category === 'cooling' ? 'cooler' : (category === 'gpu' ? 'gpu' : (category === 'case' ? 'case' : null));
    if (!datasetKey) return null;

    if (!datasetCache[datasetKey]) {
        try {
            const res = await fetch((DATASETS as any)[datasetKey]);
            if (!res.ok) return null;
            datasetCache[datasetKey] = await res.json() as any[];
        } catch {
            return null;
        }
    }

    const match = findBest(name, datasetCache[datasetKey], 0.6);
    if (!match) return null;

    if (category === 'case') {
        return {
            max_cooler_height_mm: match.max_cpu_cooler_height || null,
            max_gpu_length_mm: match.max_video_card_length || null
        };
    }

    if (category === 'cooling') {
        return {
            height_mm: match.height || null,
            max_tdp: match.tdp || null
        };
    }

    if (category === 'gpu') {
        return {
            length_mm: match.length || null,
            tdp: match.tdp || null
        };
    }

    return null;
}
