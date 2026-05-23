/**
 * PCPartPicker/docyx dataset matching service.
 * Fetches, caches, and matches components dynamically to extract high-quality specifications.
 */
import { logger } from '../engine/utils/logger.js';

const BASE_URL = 'https://raw.githubusercontent.com/docyx/pc-part-dataset/main/data/json';

const DATASETS: Record<string, string> = {
    gpu: `${BASE_URL}/video-card.json`,
    cooling: `${BASE_URL}/cpu-cooler.json`,
    case: `${BASE_URL}/case.json`,
};

// In-memory cache to avoid duplicate network requests
const datasetCache = new Map<string, any[]>();

function normalize(s: string): string {
    return s.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Token overlap score: what fraction of reference tokens appear in candidate */
function calculateTokenOverlap(reference: string, candidate: string): number {
    const refTokens = normalize(reference).split(' ').filter(t => t.length > 1);
    const candNorm = normalize(candidate);
    if (refTokens.length === 0) return 0;
    const matched = refTokens.filter(t => candNorm.includes(t));
    return matched.length / refTokens.length;
}

/** Find best match in dataset for a catalog component name */
function findBestMatch<T extends { name: string }>(
    catalogName: string,
    dataset: T[],
    minScore = 0.55,
): T | null {
    let best: T | null = null;
    let bestScore = 0;

    for (const item of dataset) {
        const score = calculateTokenOverlap(catalogName, item.name);
        if (score > bestScore) {
            bestScore = score;
            best = item;
        }
    }

    return bestScore >= minScore ? best : null;
}

async function getOrFetchDataset(category: string): Promise<any[] | null> {
    const url = DATASETS[category];
    if (!url) return null;

    if (datasetCache.has(category)) {
        return datasetCache.get(category)!;
    }

    try {
        await logger.info(`[PCPP-DATASET] Fetching dataset for ${category} from ${url}...`);
        const res = await fetch(url);
        if (!res.ok) {
            await logger.error(`[PCPP-DATASET] Failed to fetch dataset: ${res.status}`);
            return null;
        }
        const data = await res.json() as any[];
        datasetCache.set(category, data);
        await logger.info(`[PCPP-DATASET] Loaded ${data.length} entries for ${category}.`);
        return data;
    } catch (err) {
        await logger.error(`[PCPP-DATASET] Error loading dataset for ${category}: ${err}`);
        return null;
    }
}

export async function matchFromDataset(fullName: string, category: string): Promise<any> {
    const mappedCategory = category === 'cooling' ? 'cooling' : (category === 'gpu' ? 'gpu' : (category === 'case' ? 'case' : null));
    if (!mappedCategory) return null;

    const dataset = await getOrFetchDataset(mappedCategory);
    if (!dataset || dataset.length === 0) return null;

    const bestMatch = findBestMatch(fullName, dataset);
    if (!bestMatch) return null;

    await logger.info(`[PCPP-DATASET] Matched "${fullName}" -> "${bestMatch.name}" in category "${category}"`);

    // Map PCPartPicker properties to our database column naming
    if (category === 'case') {
        return {
            max_gpu_length_mm: bestMatch.max_video_card_length || null,
            max_cooler_height_mm: bestMatch.max_cpu_cooler_height || null,
        };
    }

    if (category === 'cooling') {
        return {
            max_tdp: bestMatch.tdp || null,
        };
    }

    if (category === 'gpu') {
        return {
            length_mm: bestMatch.length || null,
        };
    }

    return null;
}
