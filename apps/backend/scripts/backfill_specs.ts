/**
 * backfill_specs.ts — Schema enrichment backfill
 *
 * Parses typed spec columns from component names for all categories.
 * Safe to run multiple times — only updates NULL fields.
 *
 * Run: bun run scripts/backfill_specs.ts
 */

import { getSql } from '../src/db/index.js';

const sql = getSql();

let total = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function norm(s: string) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); }

/** Extract MPN: alphanumeric code after " - " or " | ", min 8 chars, no spaces */
function extractMpn(name: string): string | null {
    // Pattern: "Product Name - CMK16GX4M2B3200C16" or "Product Name | KF560C36BBEK2-32"
    const match = name.match(/[\-–|]\s*([A-Z0-9][A-Z0-9\-]{7,})\s*$/i);
    if (!match) return null;
    const candidate = match[1].trim();
    // Must be at least 8 chars, contain both letters and numbers, no spaces
    if (candidate.length < 8) return null;
    if (!/[A-Z]/i.test(candidate) || !/[0-9]/.test(candidate)) return null;
    if (/\s/.test(candidate)) return null;
    return candidate.toUpperCase();
}

/** Extract tags from name */
function extractTags(name: string, category: string): string[] {
    const n = norm(name);
    const tags: string[] = [];

    if (/\b(argb|rgb|aura|mystic|polychrome|fusion|prism|spectrum|chroma|razer\s*chroma)\b/.test(n)) tags.push('rgb');
    if (/\b(blanc|white|snow|argent|silver)\b/.test(n)) tags.push('white');
    if (/\b(noir|black|dark|stealth)\b/.test(n)) tags.push('black');
    if (/\b(low.?profile|lp\b|slim\b|ultra.?slim)\b/.test(n)) tags.push('low-profile');

    if (category === 'storage') {
        if (/\b(nvme|m\.?2|pcie)\b/.test(n)) tags.push('nvme');
        else if (/\b(sata|2\.5)\b/.test(n)) tags.push('sata');
        else if (/\b(hdd|hard\s*drive|disque\s*dur|nas|surveillance)\b/.test(n)) tags.push('hdd');
        if (/\b(heatsink|dissipateur|hs)\b/.test(n)) tags.push('heatsink');
    }

    if (category === 'motherboard') {
        if (/\b(wifi|wi-fi|wireless)\b/.test(n)) tags.push('wifi');
        if (/\b(bluetooth|bt\b)\b/.test(n)) tags.push('bluetooth');
    }

    if (category === 'psu') {
        if (/\b(full.?mod|fully.?mod|modulaire\s*complet)\b/.test(n)) tags.push('fully-modular');
        else if (/\b(semi.?mod)\b/.test(n)) tags.push('semi-modular');
    }

    if (category === 'cooling') {
        if (/\b(aio|liquid|watercooler|watercooling|refroidissement\s*liquide)\b/.test(n)) tags.push('aio');
        else tags.push('air');
        const radMatch = n.match(/\b(120|240|280|360|420)\s*mm\b/);
        if (radMatch) tags.push(`${radMatch[1]}mm`);
    }

    if (category === 'ram') {
        if (/\b(expo)\b/.test(n)) tags.push('expo');
        if (/\b(xmp)\b/.test(n)) tags.push('xmp');
    }

    return [...new Set(tags)]; // deduplicate
}

/** Format a string array for PostgreSQL TEXT[] parameter */
function pgArray(arr: string[]): string {
    if (arr.length === 0) return '{}';
    return '{' + arr.map(s => `"${s.replace(/"/g, '\\"')}"`).join(',') + '}';
}

async function backfillGpu() {
    const rows = (await sql`
    SELECT id, name FROM components
    WHERE category = 'gpu' AND chipset IS NULL
  `) as { id: number; name: string }[];

    let updated = 0;
    for (const { id, name } of rows) {
        const n = norm(name);

        // NVIDIA RTX/GTX
        let chipset: string | null = null;
        const rtxMatch = n.match(/\b(rtx\s*\d{4}(?:\s*(?:ti|super|xt|xtx|xl))?)\b/i);
        const gtxMatch = n.match(/\b(gtx\s*\d{4}(?:\s*(?:ti|super))?)\b/i);
        const rxMatch = n.match(/\b(rx\s*\d{3,4}(?:\s*(?:xt|xtx|gre|m))?)\b/i);
        const arcMatch = n.match(/\b(arc\s*[ab]\d{3}(?:\s*\w+)?)\b/i);

        if (rtxMatch) chipset = rtxMatch[1].replace(/\s+/g, ' ').toUpperCase();
        else if (gtxMatch) chipset = gtxMatch[1].replace(/\s+/g, ' ').toUpperCase();
        else if (rxMatch) chipset = rxMatch[1].replace(/\s+/g, ' ').toUpperCase();
        else if (arcMatch) chipset = arcMatch[1].replace(/\s+/g, ' ').toUpperCase();

        const mpn = extractMpn(name);
        const tags = extractTags(name, 'gpu');

        if (chipset || mpn || tags.length > 0) {
            await sql`
        UPDATE components SET
          chipset   = COALESCE(chipset, ${chipset}),
          mpn       = COALESCE(mpn, ${mpn}),
          tags      = COALESCE(tags, ${tags.length > 0 ? pgArray(tags) : null})
        WHERE id = ${id}
      `;
            updated++;
        }
    }
    console.log(`GPU: ${updated}/${rows.length} updated`);
    total += updated;
}

// ── Motherboard: chipset + tags ───────────────────────────────────────────────

async function backfillMotherboard() {
    const rows = (await sql`
    SELECT id, name FROM components
    WHERE category = 'motherboard' AND chipset IS NULL
  `) as { id: number; name: string }[];

    let updated = 0;
    for (const { id, name } of rows) {
        const n = norm(name);

        // Chipset: B450, B550, B650, B650E, X570, X670, X670E, Z490, Z590, Z690, Z790, H610, H670, H770, A520, A620
        const chipsetMatch = n.match(/\b([abxhz]\d{3,4}[eimdpqrsv]?)\b/i);
        const chipset = chipsetMatch ? chipsetMatch[1].toUpperCase() : null;

        const mpn = extractMpn(name);
        const tags = extractTags(name, 'motherboard');

        if (chipset || mpn || tags.length > 0) {
            await sql`
        UPDATE components SET
          chipset = COALESCE(chipset, ${chipset}),
          mpn     = COALESCE(mpn, ${mpn}),
          tags    = COALESCE(tags, ${tags.length > 0 ? pgArray(tags) : null})
        WHERE id = ${id}
      `;
            updated++;
        }
    }
    console.log(`Motherboard: ${updated}/${rows.length} updated`);
    total += updated;
}

// ── CPU: clocks + tags ────────────────────────────────────────────────────────

async function backfillCpu() {
    const rows = (await sql`
    SELECT id, name FROM components
    WHERE category = 'cpu'
  `) as { id: number; name: string }[];

    let updated = 0;
    for (const { id, name } of rows) {
        const mpn = extractMpn(name);
        const tags = extractTags(name, 'cpu');

        if (mpn || tags.length > 0) {
            await sql`
        UPDATE components SET
          mpn  = COALESCE(mpn, ${mpn}),
          tags = COALESCE(tags, ${tags.length > 0 ? pgArray(tags) : null})
        WHERE id = ${id}
      `;
            updated++;
        }
    }
    console.log(`CPU: ${updated}/${rows.length} updated`);
    total += updated;
}

// ── Storage: interface_type + capacity_gb + tags ──────────────────────────────

async function backfillStorage() {
    const rows = (await sql`
    SELECT id, name FROM components
    WHERE category = 'storage'
  `) as { id: number; name: string }[];

    let updated = 0;
    for (const { id, name } of rows) {
        const n = norm(name);

        // Interface type
        let interface_type: string | null = null;
        if (/\b(nvme|m\.?2|pcie)\b/.test(n)) interface_type = 'NVMe';
        else if (/\b(sata|2\.5|2,5)\b/.test(n)) interface_type = 'SATA';
        else if (/\b(hdd|hard\s*drive|disque\s*dur|nas|surveillance|3\.5|3,5)\b/.test(n)) interface_type = 'HDD';

        // Capacity
        let capacity_gb: number | null = null;
        const capMatch = n.match(/\b(\d+(?:[.,]\d+)?)\s*(tb|to|gb|go)\b/i);
        if (capMatch) {
            const val = parseFloat(capMatch[1].replace(',', '.'));
            const unit = capMatch[2].toLowerCase();
            capacity_gb = (unit === 'tb' || unit === 'to') ? Math.round(val * 1000) : Math.round(val);
        }

        const mpn = extractMpn(name);
        const tags = extractTags(name, 'storage');

        await sql`
      UPDATE components SET
        interface_type = COALESCE(interface_type, ${interface_type}),
        capacity_gb    = COALESCE(capacity_gb, ${capacity_gb}),
        mpn            = COALESCE(mpn, ${mpn}),
        tags           = COALESCE(tags, ${tags.length > 0 ? pgArray(tags) : null})
      WHERE id = ${id}
    `;
        updated++;
    }
    console.log(`Storage: ${updated}/${rows.length} updated`);
    total += updated;
}

// ── PSU: efficiency + modular + tags ─────────────────────────────────────────

async function backfillPsu() {
    const rows = (await sql`
    SELECT id, name FROM components
    WHERE category = 'psu'
  `) as { id: number; name: string }[];

    let updated = 0;
    for (const { id, name } of rows) {
        const n = norm(name);

        // Efficiency rating
        let efficiency_rating: string | null = null;
        if (/\b(titanium|titane)\b/.test(n)) efficiency_rating = 'Titanium';
        else if (/\b(platinum|platine)\b/.test(n)) efficiency_rating = 'Platinum';
        else if (/\b(gold|or\b)\b/.test(n)) efficiency_rating = 'Gold';
        else if (/\b(silver|argent)\b/.test(n)) efficiency_rating = 'Silver';
        else if (/\b(bronze)\b/.test(n)) efficiency_rating = 'Bronze';
        else if (/\b(80\s*plus|80plus)\b/.test(n)) efficiency_rating = '80+';

        // Modularity
        let modular: string | null = null;
        if (/\b(full.?mod|fully.?mod|modulaire\s*complet|full\s*modular)\b/.test(n)) modular = 'Full';
        else if (/\b(semi.?mod|semi\s*modular)\b/.test(n)) modular = 'Semi';
        else if (/\b(non.?mod|non\s*modular|non\s*modulaire)\b/.test(n)) modular = 'Non';

        const mpn = extractMpn(name);
        const tags = extractTags(name, 'psu');

        await sql`
      UPDATE components SET
        efficiency_rating = COALESCE(efficiency_rating, ${efficiency_rating}),
        modular           = COALESCE(modular, ${modular}),
        mpn               = COALESCE(mpn, ${mpn}),
        tags              = COALESCE(tags, ${tags.length > 0 ? pgArray(tags) : null})
      WHERE id = ${id}
    `;
        updated++;
    }
    console.log(`PSU: ${updated}/${rows.length} updated`);
    total += updated;
}

// ── RAM: capacity_gb + MPN + tags ────────────────────────────────────────────

async function backfillRam() {
    const rows = (await sql`
    SELECT id, name FROM components
    WHERE category = 'ram'
  `) as { id: number; name: string }[];

    let updated = 0;
    for (const { id, name } of rows) {
        const n = norm(name);

        // Total capacity from name: "16GB", "32Go", "64GB"
        // Take the LARGEST GB number — that's the total kit capacity
        const allMatches = [...n.matchAll(/\b(\d+)\s*[Gg][BbOo]\b/g)];
        let capacity_gb: number | null = null;
        if (allMatches.length > 0) {
            capacity_gb = Math.max(...allMatches.map(m => parseInt(m[1])));
        }

        const mpn = extractMpn(name);
        const tags = extractTags(name, 'ram');

        await sql`
      UPDATE components SET
        capacity_gb = COALESCE(capacity_gb, ${capacity_gb}),
        mpn         = COALESCE(mpn, ${mpn}),
        tags        = COALESCE(tags, ${tags.length > 0 ? pgArray(tags) : null})
      WHERE id = ${id}
    `;
        updated++;
    }
    console.log(`RAM: ${updated}/${rows.length} updated`);
    total += updated;
}

// ── Cooling: tags ─────────────────────────────────────────────────────────────

async function backfillCooling() {
    const rows = (await sql`
    SELECT id, name FROM components
    WHERE category = 'cooling'
  `) as { id: number; name: string }[];

    let updated = 0;
    for (const { id, name } of rows) {
        const mpn = extractMpn(name);
        const tags = extractTags(name, 'cooling');

        if (mpn || tags.length > 0) {
            await sql`
        UPDATE components SET
          mpn  = COALESCE(mpn, ${mpn}),
          tags = COALESCE(tags, ${tags.length > 0 ? pgArray(tags) : null})
        WHERE id = ${id}
      `;
            updated++;
        }
    }
    console.log(`Cooling: ${updated}/${rows.length} updated`);
    total += updated;
}

// ── Case: tags ────────────────────────────────────────────────────────────────

async function backfillCase() {
    const rows = (await sql`
    SELECT id, name FROM components
    WHERE category = 'case'
  `) as { id: number; name: string }[];

    let updated = 0;
    for (const { id, name } of rows) {
        const n = norm(name);
        const tags: string[] = [];

        if (/\b(argb|rgb|aura|mystic|prism)\b/.test(n)) tags.push('rgb');
        if (/\b(blanc|white|snow)\b/.test(n)) tags.push('white');
        if (/\b(noir|black|dark)\b/.test(n)) tags.push('black');
        if (/\b(tempered\s*glass|verre\s*trempé|tg\b|panneau\s*vitré)\b/.test(n)) tags.push('tempered-glass');
        if (/\b(mesh|grille|airflow)\b/.test(n)) tags.push('mesh');
        if (/\b(mini.?itx|itx)\b/.test(n)) tags.push('mini-itx');
        else if (/\b(micro.?atx|matx|m-atx)\b/.test(n)) tags.push('matx');
        else if (/\b(full.?tower|grand\s*tour)\b/.test(n)) tags.push('full-tower');
        else tags.push('mid-tower');

        const mpn = extractMpn(name);

        if (tags.length > 0 || mpn) {
            await sql`
        UPDATE components SET
          tags = COALESCE(tags, ${tags.length > 0 ? pgArray(tags) : null}),
          mpn  = COALESCE(mpn, ${mpn})
        WHERE id = ${id}
      `;
            updated++;
        }
    }
    console.log(`Case: ${updated}/${rows.length} updated`);
    total += updated;
}

// ── Fan + Thermal Paste: tags ─────────────────────────────────────────────────

async function backfillFanAndPaste() {
    const rows = (await sql`
    SELECT id, name, category FROM components
    WHERE category IN ('fan', 'thermal_paste')
  `) as { id: number; name: string; category: string }[];

    let updated = 0;
    for (const { id, name, category } of rows) {
        const n = norm(name);
        const tags: string[] = [];

        if (/\b(argb|rgb|aura|prism)\b/.test(n)) tags.push('rgb');
        if (/\b(blanc|white)\b/.test(n)) tags.push('white');
        if (/\b(noir|black)\b/.test(n)) tags.push('black');

        const mpn = extractMpn(name);

        if (tags.length > 0 || mpn) {
            await sql`
        UPDATE components SET
          tags = COALESCE(tags, ${tags.length > 0 ? pgArray(tags) : null}),
          mpn  = COALESCE(mpn, ${mpn})
        WHERE id = ${id}
      `;
            updated++;
        }
    }
    console.log(`Fan/Paste: ${updated}/${rows.length} updated`);
    total += updated;
}

// ── Run all ───────────────────────────────────────────────────────────────────

console.log('Starting spec backfill...\n');

await backfillGpu();
await backfillMotherboard();
await backfillCpu();
await backfillStorage();
await backfillPsu();
await backfillRam();
await backfillCooling();
await backfillCase();
await backfillFanAndPaste();

console.log(`\nDone. Total rows updated: ${total}`);
process.exit(0);
