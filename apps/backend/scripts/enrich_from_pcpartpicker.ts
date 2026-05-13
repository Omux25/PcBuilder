/**
 * enrich_from_pcpartpicker.ts
 *
 * Downloads the pc-part-dataset (docyx/pc-part-dataset on GitHub) and matches
 * entries to our catalog to fill in missing spec fields.
 *
 * Fields filled per category:
 *   CPU:         core_count, boost_clock_ghz, base_clock_ghz, tdp, socket
 *   GPU:         chipset, vram_gb, length_mm, tdp (boost_clock as proxy)
 *   Motherboard: form_factor, ram_slots, socket, m2_slots, chipset
 *   Cooling:     height_mm, supported_sockets, max_tdp (and radiator size in tags)
 *   Case:        form_factor, max_cooler_height_mm, max_gpu_length_mm (and 3.5 bays in tags)
 *   Storage:     capacity_gb, interface_type
 *   PSU:         efficiency_rating, modular, psu_form_factor
 *   RAM:         cas_latency, kit_count, capacity_gb
 *
 * Matching strategy:
 *   - Normalize both names (lowercase, strip punctuation, collapse spaces)
 *   - For CPU/GPU: use token overlap — require chipset/model tokens to match
 *   - For others: require brand + key model tokens to match
 *   - Only update NULL fields — never overwrite existing data (except tags)
 *
 * Run: bun run scripts/enrich_from_pcpartpicker.ts
 */

import { getSql } from '../src/core/db/index.js';

const sql = getSql();

// ── Dataset URLs ──────────────────────────────────────────────────────────────

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

// ── Normalization ─────────────────────────────────────────────────────────────

function norm(s: string): string {
    return s.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Token overlap score: what fraction of reference tokens appear in candidate */
function tokenOverlap(reference: string, candidate: string): number {
    const refTokens = norm(reference).split(' ').filter(t => t.length > 1);
    const candNorm = norm(candidate);
    if (refTokens.length === 0) return 0;
    const matched = refTokens.filter(t => candNorm.includes(t));
    return matched.length / refTokens.length;
}

/** Find best match in dataset for a catalog component name */
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

// ── Fetch dataset ─────────────────────────────────────────────────────────────

async function fetchDataset<T>(url: string): Promise<T[]> {
    console.log(`  Fetching ${url}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json() as Promise<T[]>;
}

// ── CPU enrichment ────────────────────────────────────────────────────────────

interface PcppCpu {
    name: string;
    core_count: number | null;
    core_clock: number | null;   // GHz
    boost_clock: number | null;  // GHz
    tdp: number | null;
    socket: string | null;
    microarchitecture: string | null;
}

async function enrichCpu() {
    console.log('\n[CPU] Fetching dataset...');
    const dataset = await fetchDataset<PcppCpu>(DATASETS.cpu);
    console.log(`  ${dataset.length} entries loaded`);

    const rows = (await sql`
    SELECT id, name, brand, core_count, base_clock_ghz, boost_clock_ghz, tdp, socket
    FROM components
    WHERE category = 'cpu'
      AND (core_count IS NULL OR base_clock_ghz IS NULL OR boost_clock_ghz IS NULL OR tdp IS NULL OR socket IS NULL)
  `) as any[];

    console.log(`  ${rows.length} CPUs need enrichment`);
    let updated = 0;

    for (const row of rows) {
        const searchName = `${row.brand ?? ''} ${row.name}`.trim();
        const match = findBest(searchName, dataset, 0.6);
        if (!match) continue;

        await sql`
      UPDATE components SET
        core_count      = COALESCE(core_count, ${match.core_count ?? null}),
        base_clock_ghz  = COALESCE(base_clock_ghz, ${match.core_clock ?? null}),
        boost_clock_ghz = COALESCE(boost_clock_ghz, ${match.boost_clock ?? null}),
        tdp             = COALESCE(tdp, ${match.tdp ?? null}),
        socket          = COALESCE(socket, ${match.socket ?? null}),
        updated_at      = NOW()
      WHERE id = ${row.id}
    `;
        console.log(`  ✓ CPU [${row.id}] "${row.name}" ← "${match.name}" (cores:${match.core_count} boost:${match.boost_clock}GHz socket:${match.socket})`);
        updated++;
    }

    console.log(`  CPU: ${updated}/${rows.length} updated`);
    return updated;
}

// ── GPU enrichment ────────────────────────────────────────────────────────────

interface PcppGpu {
    name: string;
    chipset: string | null;
    memory: number | null;       // GB
    boost_clock: number | null;  // MHz
    length: number | null;       // mm
}

function buildGpuChipsetIndex(dataset: PcppGpu[]): Map<string, PcppGpu[]> {
    const index = new Map<string, PcppGpu[]>();
    for (const item of dataset) {
        if (!item.chipset) continue;
        const key = norm(item.chipset);
        if (!index.has(key)) index.set(key, []);
        index.get(key)!.push(item);
    }
    return index;
}

function extractGpuChipsetFromName(name: string): string | null {
    const n = norm(name);
    const rtxMatch = n.match(/\b(rtx|gtx)\s*(\d{4})\s*(ti\s*super|ti|super|xt|xtx)?\b/);
    if (rtxMatch) return `${rtxMatch[1]} ${rtxMatch[2]}${rtxMatch[3] ? ' ' + rtxMatch[3] : ''}`.trim();
    const rxMatch = n.match(/\brx\s*(\d{3,4})\s*(xtx|xt|gre|m)?\b/);
    if (rxMatch) return `rx ${rxMatch[1]}${rxMatch[2] ? ' ' + rxMatch[2] : ''}`.trim();
    const arcMatch = n.match(/\barc\s*([ab]\d{3})\b/);
    if (arcMatch) return `arc ${arcMatch[1]}`;
    return null;
}

async function enrichGpu() {
    console.log('\n[GPU] Fetching dataset...');
    const dataset = await fetchDataset<PcppGpu>(DATASETS.gpu);
    console.log(`  ${dataset.length} entries loaded`);

    const chipsetIndex = buildGpuChipsetIndex(dataset);

    const rows = (await sql`
    SELECT id, name, brand, chipset, vram_gb, length_mm
    FROM components
    WHERE category = 'gpu'
      AND (chipset IS NULL OR vram_gb IS NULL OR length_mm IS NULL)
  `) as any[];

    console.log(`  ${rows.length} GPUs need enrichment`);
    let updated = 0;

    for (const row of rows) {
        const fullName = `${row.brand ?? ''} ${row.name}`.trim();
        const ourChipset = extractGpuChipsetFromName(row.name);
        let candidates: PcppGpu[] = [];

        if (ourChipset) {
            for (const [key, items] of chipsetIndex) {
                if (key.includes(ourChipset) || ourChipset.split(' ').every(t => key.includes(t))) {
                    candidates.push(...items);
                }
            }
        }

        if (candidates.length === 0) {
            const match = findBest(fullName, dataset, 0.6);
            if (match) candidates = [match];
        }

        if (candidates.length === 0) continue;
        const best = candidates.find(c => c.length != null) ?? candidates[0];

        if (best.chipset) {
            const chipsetTokens = norm(best.chipset).split(' ').filter(t => t.length > 2 && !/^(geforce|radeon|intel)$/.test(t));
            const nameNorm = norm(fullName);
            const chipsetMatch = chipsetTokens.filter(t => nameNorm.includes(t));
            if (chipsetMatch.length < Math.ceil(chipsetTokens.length * 0.6)) continue;
        }

        await sql`
      UPDATE components SET
        chipset    = COALESCE(chipset, ${best.chipset ?? null}),
        vram_gb    = COALESCE(vram_gb, ${best.memory ?? null}),
        length_mm  = COALESCE(length_mm, ${best.length ?? null}),
        updated_at = NOW()
      WHERE id = ${row.id}
    `;
        console.log(`  ✓ GPU [${row.id}] "${row.name}" ← chipset:"${best.chipset}" vram:${best.memory}GB len:${best.length}mm`);
        updated++;
    }

    console.log(`  GPU: ${updated}/${rows.length} updated`);
    return updated;
}

// ── Motherboard enrichment ────────────────────────────────────────────────────

interface PcppMotherboard {
    name: string;
    socket: string | null;
    form_factor: string | null;
    max_memory: number | null;
    memory_slots: number | null;
    m2_slots: string[] | number | null;
    chipset: string | null;
}

function normalizeFormFactor(ff: string | null): string | null {
    if (!ff) return null;
    const n = ff.toLowerCase();
    if (n.includes('mini itx') || n === 'mini-itx') return 'Mini-ITX';
    if (n.includes('micro atx') || n.includes('matx') || n.includes('microatx')) return 'mATX';
    if (n.includes('e-atx') || n.includes('eatx')) return 'E-ATX';
    if (n.includes('atx')) return 'ATX';
    return ff;
}

async function enrichMotherboard() {
    console.log('\n[Motherboard] Fetching dataset...');
    const dataset = await fetchDataset<PcppMotherboard>(DATASETS.motherboard);
    console.log(`  ${dataset.length} entries loaded`);

    const rows = (await sql`
    SELECT id, name, brand, form_factor, ram_slots, socket, m2_slots, chipset
    FROM components
    WHERE category = 'motherboard'
      AND (form_factor IS NULL OR ram_slots IS NULL OR socket IS NULL OR m2_slots IS NULL OR chipset IS NULL)
  `) as any[];

    console.log(`  ${rows.length} motherboards need enrichment`);
    let updated = 0;

    for (const row of rows) {
        const searchName = `${row.brand ?? ''} ${row.name}`.trim();
        const match = findBest(searchName, dataset, 0.6);
        if (!match) continue;

        const ff = normalizeFormFactor(match.form_factor);
        const m2Count = Array.isArray(match.m2_slots) ? match.m2_slots.length : (typeof match.m2_slots === 'number' ? match.m2_slots : (typeof match.m2_slots === 'string' ? parseInt(match.m2_slots) : null));

        await sql`
      UPDATE components SET
        form_factor = COALESCE(form_factor, ${ff}),
        ram_slots   = COALESCE(ram_slots, ${match.memory_slots ?? null}),
        socket      = COALESCE(socket, ${match.socket ?? null}),
        m2_slots    = COALESCE(m2_slots, ${m2Count}),
        chipset     = COALESCE(chipset, ${match.chipset ?? null}),
        updated_at  = NOW()
      WHERE id = ${row.id}
    `;
        console.log(`  ✓ MB [${row.id}] "${row.name}" ← "${match.name}" (ff:${ff} socket:${match.socket} m2:${m2Count})`);
        updated++;
    }

    console.log(`  Motherboard: ${updated}/${rows.length} updated`);
    return updated;
}

// ── Storage enrichment ────────────────────────────────────────────────────────

interface PcppStorage {
    name: string;
    capacity: number | null;
    type: string | null;
    interface: string | null;
}

async function enrichStorage() {
    console.log('\n[Storage] Fetching dataset...');
    const dataset = await fetchDataset<PcppStorage>(DATASETS.storage);
    console.log(`  ${dataset.length} entries loaded`);

    const rows = (await sql`
    SELECT id, name, brand, capacity_gb, interface_type
    FROM components
    WHERE category = 'storage'
      AND (capacity_gb IS NULL OR interface_type IS NULL)
  `) as any[];

    console.log(`  ${rows.length} storage entries need enrichment`);
    let updated = 0;

    for (const row of rows) {
        const searchName = `${row.brand ?? ''} ${row.name}`.trim();
        const match = findBest(searchName, dataset, 0.6);
        if (!match) continue;

        await sql`
      UPDATE components SET
        capacity_gb    = COALESCE(capacity_gb, ${match.capacity ?? null}),
        interface_type = COALESCE(interface_type, ${match.interface ?? null}),
        updated_at     = NOW()
      WHERE id = ${row.id}
    `;
        console.log(`  ✓ Storage [${row.id}] "${row.name}" ← "${match.name}" (cap:${match.capacity}GB interface:${match.interface})`);
        updated++;
    }

    console.log(`  Storage: ${updated}/${rows.length} updated`);
    return updated;
}

// ── PSU enrichment ────────────────────────────────────────────────────────────

interface PcppPsu {
    name: string;
    type: string | null;
    efficiency: string | null;
    wattage: number | null;
    modular: string | null;
}

function normalizeEfficiency(e: string | null): string | null {
    if (!e) return null;
    const n = e.toLowerCase();
    if (n.includes('titanium')) return 'Titanium';
    if (n.includes('platinum')) return 'Platinum';
    if (n.includes('gold')) return 'Gold';
    if (n.includes('silver')) return 'Silver';
    if (n.includes('bronze')) return 'Bronze';
    if (n.includes('plus') || n === '80+') return '80+';
    return null;
}

function normalizeModular(m: string | null | boolean): string | null {
    if (m === null || m === false || m === 'false') return 'Non';
    if (typeof m === 'string') {
        if (m.toLowerCase().includes('full')) return 'Full';
        if (m.toLowerCase().includes('semi')) return 'Semi';
    }
    return null;
}

async function enrichPsu() {
    console.log('\n[PSU] Fetching dataset...');
    const dataset = await fetchDataset<PcppPsu>(DATASETS.psu);
    console.log(`  ${dataset.length} entries loaded`);

    const rows = (await sql`
    SELECT id, name, brand, wattage, efficiency_rating, modular, psu_form_factor
    FROM components
    WHERE category = 'psu'
      AND (efficiency_rating IS NULL OR modular IS NULL)
  `) as any[];

    console.log(`  ${rows.length} PSUs need enrichment`);
    let updated = 0;

    for (const row of rows) {
        const fullName = `${row.brand ?? ''} ${row.name}`.trim();
        let wattage = row.wattage;
        if (!wattage) {
            const wMatch = row.name.match(/\b(\d{3,4})\s*[Ww]\b/);
            if (wMatch) wattage = parseInt(wMatch[1]);
        }

        let best: PcppPsu | null = null;
        if (wattage) {
            const sameWattage = dataset.filter(d => d.wattage === wattage);
            if (sameWattage.length > 0) {
                best = findBest(fullName, sameWattage, 0.4) ?? null;
            }
        }
        if (!best) {
            best = findBest(fullName, dataset, 0.6) ?? null;
        }

        if (!best) continue;
        if (wattage && best.wattage && Math.abs(wattage - best.wattage) > 50) continue;

        const eff = normalizeEfficiency(best.efficiency);
        const mod = normalizeModular(best.modular as string | null);
        const psuType = best.type ?? null;

        await sql`
      UPDATE components SET
        efficiency_rating = COALESCE(efficiency_rating, ${eff}),
        modular           = COALESCE(modular, ${mod}),
        psu_form_factor   = COALESCE(psu_form_factor, ${psuType}),
        updated_at        = NOW()
      WHERE id = ${row.id}
    `;
        console.log(`  ✓ PSU [${row.id}] "${row.name}" ← "${best.name}" (eff:${eff} mod:${mod} type:${psuType})`);
        updated++;
    }

    console.log(`  PSU: ${updated}/${rows.length} updated`);
    return updated;
}

// ── RAM enrichment ────────────────────────────────────────────────────────────

interface PcppRam {
    name: string;
    speed: [number, number] | null;
    modules: [number, number] | null;
    cas_latency: number | null;
}

async function enrichRam() {
    console.log('\n[RAM] Fetching dataset...');
    const dataset = await fetchDataset<PcppRam>(DATASETS.ram);
    console.log(`  ${dataset.length} entries loaded`);

    const rows = (await sql`
    SELECT id, name, brand, frequency_mhz, cas_latency, kit_count, capacity_gb
    FROM components
    WHERE category = 'ram'
      AND (cas_latency IS NULL OR capacity_gb IS NULL)
  `) as any[];

    console.log(`  ${rows.length} RAM entries need enrichment`);
    let updated = 0;

    for (const row of rows) {
        const fullName = `${row.brand ?? ''} ${row.name}`.trim();
        let best: PcppRam | null = null;

        if (row.frequency_mhz) {
            const sameFreq = dataset.filter(d => d.speed && d.speed[1] === row.frequency_mhz);
            if (sameFreq.length > 0) {
                best = findBest(fullName, sameFreq, 0.35) ?? null;
            }
        }
        if (!best) {
            best = findBest(fullName, dataset, 0.55) ?? null;
        }

        if (!best) continue;
        if (row.frequency_mhz && best.speed && Math.abs(best.speed[1] - row.frequency_mhz) > 200) continue;

        const capacityGb = best.modules ? best.modules[0] * best.modules[1] : null;

        await sql`
      UPDATE components SET
        cas_latency = COALESCE(cas_latency, ${best.cas_latency ?? null}),
        capacity_gb = COALESCE(capacity_gb, ${capacityGb}),
        updated_at  = NOW()
      WHERE id = ${row.id}
    `;
        console.log(`  ✓ RAM [${row.id}] "${row.name}" ← "${best.name}" (cl:${best.cas_latency} cap:${capacityGb}GB)`);
        updated++;
    }

    console.log(`  RAM: ${updated}/${rows.length} updated`);
    return updated;
}

// ── Cooling enrichment ────────────────────────────────────────────────────────

interface PcppCooler {
    name: string;
    size: number | null;
    height: number | null;
    sockets: string[] | string | null;
    tdp: number | null;
}

async function enrichCooling() {
    console.log('\n[Cooling] Fetching dataset...');
    const dataset = await fetchDataset<PcppCooler>(DATASETS.cooler);
    console.log(`  ${dataset.length} entries loaded`);

    const rows = (await sql`
    SELECT id, name, brand, tags, height_mm, supported_sockets, max_tdp
    FROM components
    WHERE category = 'cooling'
  `) as any[];

    console.log(`  ${rows.length} coolers to check`);
    let updated = 0;

    for (const row of rows) {
        const searchName = `${row.brand ?? ''} ${row.name}`.trim();
        const match = findBest(searchName, dataset, 0.6);
        if (!match) continue;

        let pgTags = row.tags ? '{' + row.tags.map((t: string) => `"${t}"`).join(',') + '}' : null;
        if (match.size != null) {
            const existingTags = row.tags ?? [];
            const sizeTag = `${match.size}mm`;
            if (!existingTags.includes(sizeTag)) {
                const newTags = [...existingTags.filter((t: string) => !t.endsWith('mm')), sizeTag];
                pgTags = '{' + newTags.map(t => `"${t}"`).join(',') + '}';
            }
        }

        let sockets: string[] | null = null;
        if (Array.isArray(match.sockets)) {
            sockets = match.sockets;
        } else if (typeof match.sockets === 'string') {
            sockets = match.sockets.split(',').map(s => s.trim());
        }
        const pgSockets = sockets ? '{' + sockets.map(s => `"${s}"`).join(',') + '}' : null;

        await sql`
      UPDATE components SET
        tags              = COALESCE(tags, ${pgTags}::text[]),
        height_mm         = COALESCE(height_mm, ${match.height ?? null}),
        supported_sockets = COALESCE(supported_sockets, ${pgSockets}::text[]),
        max_tdp           = COALESCE(max_tdp, ${match.tdp ?? null}),
        updated_at        = NOW()
      WHERE id = ${row.id}
    `;
        console.log(`  ✓ Cooler [${row.id}] "${row.name}" ← "${match.name}" (height:${match.height}mm tdp:${match.tdp}W)`);
        updated++;
    }

    console.log(`  Cooling: ${updated}/${rows.length} updated`);
    return updated;
}

// ── Case enrichment ───────────────────────────────────────────────────────────

interface PcppCase {
    name: string;
    type: string | null;
    internal_35_bays: number | null;
    max_cpu_cooler_height: number | null;
    max_video_card_length: number | null;
}

function caseTypeToFormFactor(type: string | null): string | null {
    if (!type) return null;
    const n = type.toLowerCase();
    if (n.includes('mini itx') || n.includes('mini-itx')) return 'Mini-ITX';
    if (n.includes('microatx') || n.includes('micro atx') || n.includes('matx')) return 'mATX';
    if (n.includes('full tower')) return 'Full Tower';
    if (n.includes('mid tower') || n.includes('atx')) return 'ATX';
    return null;
}

async function enrichCase() {
    console.log('\n[Case] Fetching dataset...');
    const dataset = await fetchDataset<PcppCase>(DATASETS.case);
    console.log(`  ${dataset.length} entries loaded`);

    const rows = (await sql`
    SELECT id, name, brand, form_factor, tags, max_cooler_height_mm, max_gpu_length_mm
    FROM components
    WHERE category = 'case'
  `) as any[];

    console.log(`  ${rows.length} cases need enrichment`);
    let updated = 0;

    for (const row of rows) {
        const searchName = `${row.brand ?? ''} ${row.name}`.trim();
        const match = findBest(searchName, dataset, 0.6);
        if (!match) continue;

        const ff = caseTypeToFormFactor(match.type);
        const existingTags = row.tags ?? [];
        const newTags = [...existingTags];
        if (match.internal_35_bays != null && !newTags.some(t => t.includes('bay'))) {
            newTags.push(`${match.internal_35_bays}x3.5bay`);
        }
        const pgTags = newTags.length > 0 ? '{' + newTags.map(t => `"${t}"`).join(',') + '}' : null;

        await sql`
      UPDATE components SET
        form_factor          = COALESCE(form_factor, ${ff}),
        tags                 = COALESCE(tags, ${pgTags}::text[]),
        max_cooler_height_mm = COALESCE(max_cooler_height_mm, ${match.max_cpu_cooler_height ?? null}),
        max_gpu_length_mm    = COALESCE(max_gpu_length_mm, ${match.max_video_card_length ?? null}),
        updated_at           = NOW()
      WHERE id = ${row.id}
    `;
        console.log(`  ✓ Case [${row.id}] "${row.name}" ← "${match.name}" (cooler:${match.max_cpu_cooler_height}mm gpu:${match.max_video_card_length}mm)`);
        updated++;
    }

    console.log(`  Case: ${updated}/${rows.length} updated`);
    return updated;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('=== PC Part Dataset Enrichment (Round 2 — improved matching) ===');
console.log('Source: github.com/docyx/pc-part-dataset (MIT License)\n');

let total = 0;
total += await enrichCpu();
total += await enrichGpu();
total += await enrichMotherboard();
total += await enrichStorage();
total += await enrichPsu();
total += await enrichRam();
total += await enrichCooling();
total += await enrichCase();

console.log(`\n=== Done. Total rows updated: ${total} ===`);
process.exit(0);
