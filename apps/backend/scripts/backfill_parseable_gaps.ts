/**
 * backfill_parseable_gaps.ts
 *
 * Fills remaining NULL fields that can be derived from component names alone.
 * Runs after enrich_from_pcpartpicker.ts to catch what the dataset couldn't match.
 *
 * Targets:
 *   Storage:  interface_type, capacity_gb
 *   PSU:      modular, efficiency_rating (from name keywords)
 *   Case:     form_factor (from name/brand keywords)
 *   GPU:      chipset (from name — RTX/RX/Arc pattern)
 *   RAM:      capacity_gb (from name — largest GB number)
 *   CPU:      tdp (heuristic by socket/series)
 *
 * Run: bun run scripts/backfill_parseable_gaps.ts
 */

import { getSql } from '../src/core/db/index.js';

const sql = getSql();
let total = 0;

function norm(s: string) { return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }

// ── Storage: interface_type + capacity_gb ─────────────────────────────────────

async function backfillStorage() {
  const rows = (await sql`
    SELECT id, name FROM components
    WHERE category = 'storage' AND is_active = true
      AND (interface_type IS NULL OR capacity_gb IS NULL)
  `) as { id: number; name: string }[];

  let updated = 0;
  for (const { id, name } of rows) {
    const n = norm(name);

    // Interface type
    let interface_type: string | null = null;
    if (/\b(nvme|m\.?2|pcie|sn\d{3}|cardea|zero|spatium|mp\d{3}|legend|firecuda|barracuda\s*ssd|870|860|850|840|qvo|evo\s*plus|evo\s*ssd|980|990|970|p[235]\s*\d{3}|game\s*drive\s*ssd|cl100|cx400|c100|c200|c300|c400|c500|c600|c700|c800|c900|cs21[34]0|cs900|cs1030|dc\d{3}m?|mp\d{3}|kc\d{4}|nq100|hiksemi|fanxiang|s101|a55|gx2|vi\d{3,4}|bx\d{3}|mx\d{3}|su\d{3}|a400|s270|ns100|s300|s300\s*pro|n300\s*nas|sata\s*iii|2\.5\s*tray|sata\s*2\.5)\b/.test(n)) {
      // Distinguish NVMe from SATA SSDs
      if (/\b(nvme|m\.?2|pcie|sn\d{3}|cardea|zero|spatium|mp\d{3}|legend|firecuda\s*\d|980|990|970|p[235]\s*\d{3}|game\s*drive\s*ssd|cl100|cx400|c100|c200|c300|c400|c500|c600|c700|c800|c900|cs21[34]0|dc\d{3}m?|kc\d{4}|nq100)\b/.test(n)) {
        interface_type = 'NVMe';
      } else {
        interface_type = 'SATA';
      }
    } else if (/\b(hdd|hard\s*drive|disque\s*dur|nas|surveillance|ironwolf|skyhawk|exos|barracuda\s*\d|seagate\s*\d|wd\s*(red|blue|purple|gold)|3\.5|cmr|smr|rpm|enterprise\s*(capacity|mg)|mg\s*(series|0[0-9])|blue\s*wd|azlx|enterprise)\b/.test(n)) {
      interface_type = 'HDD';
    }
    // Brand-specific: Samsung 980/990 Pro = NVMe, Barracuda without "SSD" = HDD
    if (!interface_type) {
      if (/\b(980|990|970)\s*(pro|evo)?\b/.test(n)) interface_type = 'NVMe';
      else if (/\bnm790\b/.test(n)) interface_type = 'NVMe';
      else if (/\bp310\b/.test(n)) interface_type = 'NVMe';
      else if (/\bssd\s*\d+\s*(gen[345]|pcie)\b/.test(n)) interface_type = 'NVMe';
      else if (/\bbarracuda\b/.test(n) && !/\bssd\b/.test(n)) interface_type = 'HDD';
      else if (/\b(goodram|hikvision|hiksemi|fanxiang|timetec|netac|kingspec|intenso)\b/.test(n)) interface_type = 'SATA';
      else if (/\b(enterprise|mg\s*series|mg0[0-9]|ultrastar|exos|purple\s*video|videosurveillance|red\s*pro|red\s*\d+tb|blue\s*wd|azlx)\b/.test(n)) interface_type = 'HDD';
      else if (/\b(portable\s*ssd|t[57]\s*(evo)?|game\s*drive|p50|my\s*passport|elements)\b/.test(n)) interface_type = 'SATA'; // external/portable
      else if (/\bssd\b/.test(n) && !/\b(nvme|m\.?2|pcie)\b/.test(n)) interface_type = 'SATA'; // generic SSD without NVMe keyword
    }

    // Capacity
    let capacity_gb: number | null = null;
    const tbMatch = n.match(/\b(\d+(?:[.,]\d+)?)\s*(tb|to)\b/);
    const gbMatch = n.match(/\b(\d{2,4})\s*(gb|go)\b/);
    if (tbMatch) {
      capacity_gb = Math.round(parseFloat(tbMatch[1].replace(',', '.')) * 1000);
    } else if (gbMatch) {
      capacity_gb = parseInt(gbMatch[1]);
    }

    if (!interface_type && !capacity_gb) continue;

    await sql`
      UPDATE components SET
        interface_type = COALESCE(interface_type, ${interface_type}),
        capacity_gb    = COALESCE(capacity_gb, ${capacity_gb}),
        updated_at     = NOW()
      WHERE id = ${id}
    `;
    updated++;
  }
  console.log(`Storage: ${updated}/${rows.length} updated`);
  total += updated;
}

// ── PSU: modular + efficiency_rating from name ────────────────────────────────

async function backfillPsu() {
  const rows = (await sql`
    SELECT id, name FROM components
    WHERE category = 'psu' AND is_active = true
      AND (modular IS NULL OR efficiency_rating IS NULL)
  `) as { id: number; name: string }[];

  let updated = 0;
  for (const { id, name } of rows) {
    const n = norm(name);

    let modular: string | null = null;
    if (/\b(full.?mod|fully.?mod|modulaire\s*complet|full\s*modular|modular\s*complet)\b/.test(n)) modular = 'Full';
    else if (/\b(semi.?mod|semi\s*modular|semi\s*modulaire)\b/.test(n)) modular = 'Semi';
    else if (/\b(non.?mod|non\s*modular|non\s*modulaire|sans\s*mod)\b/.test(n)) modular = 'Non';
    // Infer from known model patterns
    else if (/\b(rm\d{3,4}[eix]?|hx\d{3,4}|ax\d{3,4}|px\d{3,4}|focus\s*plus|prime\s*gold|prime\s*platinum|vertex\s*gx|toughpower\s*gf|straight\s*power|dark\s*power|mwe\s*gold|v\d{3,4}\s*(gold|platinum|sfx)|xg\d{3,4}|atom\s*g\d{3,4}|c\d{3,4}\s*(gold|bronze|platinum)|ud\d{3,4}gm|p\d{3,4}gm|ne\d{3,4}g|a\d{3,4}gls|a850gls|hx\d{3,4}i|loki|thor|strix\s*(gold|platinum)|tuf\s*gaming\s*\d{3,4}g|rog\s*strix\s*\d{3,4}g|prime\s*ap|edge\s*(gold|platinum)|mwe\s*gold\s*v[23]|mwe\s*gold\s*\d{3,4}|g12\s*gm|ud\d{3,4}|p\d{3,4}ss|p\d{3,4}gm)\b/.test(n)) modular = 'Full';
    else if (/\b(cx\d{3,4}m|tx\d{3,4}m|mwe\s*bronze|system\s*power|pure\s*power\s*\d+\s*m|g12\s*gc|ea\d{3,4}g\s*pro|c\d{3,4}\s*bronze)\b/.test(n)) modular = 'Semi';
    else if (/\b(cv\d{3,4}|cx\d{3,4}[^m]|elite|smart|litepower|b12|mwe\s*bronze\s*v[23]|mag\s*a\d{3,4}b|a\d{3,4}dn|a\d{3,4}n|anima|apb\d{3}|apiii|atom\s*b\d{3}|c\d{3,4}\s*bronze|connect\s*\d{3,4}w|550w\s*80plus\s*bronze|650w\s*80plus\s*bronze)\b/.test(n)) modular = 'Non';
    // Modulaire keyword in French
    else if (/\bmodulaire\b/.test(n)) modular = 'Full';
    // Connect PSU = Non modular (budget brand)
    else if (/\bconnect\s*(psu|pc)\b/.test(n)) modular = 'Non';
    // Hybrok PSU = Non modular
    else if (/\bhybrok\s*psu\b/.test(n)) modular = 'Non';
    // Lian Li Edge = Full modular
    else if (/\bedge\s*\d{3,4}\b/.test(n) && /\b(gold|platinum)\b/.test(n)) modular = 'Full';
    // Antec G-series = Semi modular
    else if (/\b(g750|g850|g1000)\b/.test(n) && /\bgold\b/.test(n)) modular = 'Semi';
    // Csk = Non modular
    else if (/\bcsk\d{3,4}\b/.test(n)) modular = 'Non';
    // Gaming Usa E2 = Full modular
    else if (/\bgaming\s*usa\s*e2\b/.test(n)) modular = 'Full';

    let efficiency_rating: string | null = null;
    if (/\b(titanium|titane)\b/.test(n)) efficiency_rating = 'Titanium';
    else if (/\b(platinum|platine)\b/.test(n)) efficiency_rating = 'Platinum';
    else if (/\b(gold|or\b)\b/.test(n)) efficiency_rating = 'Gold';
    else if (/\b(silver|argent)\b/.test(n)) efficiency_rating = 'Silver';
    else if (/\b(bronze)\b/.test(n)) efficiency_rating = 'Bronze';
    else if (/\b(80\s*plus|80plus)\b/.test(n)) efficiency_rating = '80+';

    if (!modular && !efficiency_rating) continue;

    await sql`
      UPDATE components SET
        modular           = COALESCE(modular, ${modular}),
        efficiency_rating = COALESCE(efficiency_rating, ${efficiency_rating}),
        updated_at        = NOW()
      WHERE id = ${id}
    `;
    updated++;
  }
  console.log(`PSU: ${updated}/${rows.length} updated`);
  total += updated;
}

// ── Case: form_factor from name ───────────────────────────────────────────────

async function backfillCase() {
  const rows = (await sql`
    SELECT id, name, brand FROM components
    WHERE category = 'case' AND is_active = true AND form_factor IS NULL
  `) as { id: number; name: string; brand: string | null }[];

  let updated = 0;
  for (const { id, name, brand } of rows) {
    const n = norm(`${brand ?? ''} ${name}`);

    let form_factor: string | null = null;

    // Explicit keywords
    if (/\b(mini.?itx|mini\s*itx|itx\s*case|itx\s*tower)\b/.test(n)) form_factor = 'Mini-ITX';
    else if (/\b(micro.?atx|matx|m.?atx|micro\s*tour|mini\s*tower|microatx)\b/.test(n)) form_factor = 'mATX';
    else if (/\b(full.?tower|grand\s*tour|xl\s*tower|super\s*tower|e.?atx)\b/.test(n)) form_factor = 'Full Tower';
    else if (/\b(mid.?tower|atx\s*mid|atx\s*tower|tour\s*atx|boitier\s*atx)\b/.test(n)) form_factor = 'ATX';

    // Brand-specific model patterns
    if (!form_factor) {
      const b = (brand ?? '').toLowerCase();
      const nm = norm(name);

      // ASUS cases
      if (b === 'asus') {
        if (/\b(a21|a31)\b/.test(nm)) form_factor = 'mATX';
        else if (/\b(gr701|hyperion)\b/.test(nm)) form_factor = 'Full Tower';
        else form_factor = 'ATX';
      }
      // Aerocool — most are ATX
      else if (b === 'aerocool') {
        if (/\b(mini|micro|matx)\b/.test(nm)) form_factor = 'mATX';
        else form_factor = 'ATX';
      }
      // 1stPlayer, Abkoncore, Xigmatek, Silverstone, BitFenix, Sharkoon, Raijintek
      else if (/^(1stplayer|abkoncore|xigmatek|silverstone|bitfenix|sharkoon|raijintek)$/.test(b)) form_factor = 'ATX';
      // Lian Li O11 = ATX, A3 = mATX
      else if (/\blian\s*li\b/.test(n) && /\bo11\b/.test(n)) form_factor = 'ATX';
      else if (/\blian\s*li\b/.test(n) && /\ba3\b/.test(n)) form_factor = 'mATX';
      else if (/\blian\s*li\b/.test(n)) form_factor = 'ATX';
      // NZXT H-series
      else if (/\bnzxt\b/.test(n)) {
        if (/\bh1\b/.test(nm)) form_factor = 'Mini-ITX';
        else form_factor = 'ATX';
      }
      // Corsair
      else if (/\bcorsair\b/.test(n)) {
        if (/\b(2500|280x)\b/.test(nm)) form_factor = 'mATX';
        else form_factor = 'ATX';
      }
      // Fractal
      else if (/\bfractal\b/.test(n)) form_factor = 'ATX';
      // Deepcool
      else if (/\bdeepcool\b/.test(n)) {
        if (/\bch1[67]\d\b/.test(nm)) form_factor = 'Mini-ITX';
        else if (/\bch2[67]\d\b/.test(nm)) form_factor = 'mATX';
        else form_factor = 'ATX';
      }
      // Thermaltake
      else if (/\bthermaltake\b/.test(n)) {
        if (/\btower\s*300\b/.test(nm)) form_factor = 'mATX';
        else form_factor = 'ATX';
      }
      // Cooler Master
      else if (/\bcooler\s*master\b/.test(n)) {
        if (/\bnr200\b/.test(nm)) form_factor = 'Mini-ITX';
        else if (/\bq300\b/.test(nm)) form_factor = 'mATX';
        else form_factor = 'ATX';
      }
      // MSI, Gigabyte, be quiet!, Phanteks, Montech, Antec, Kolink, Cougar
      // HYTE, APNX, HAVN, Razer, Gamdias, NOX, AZZA, Itek, Spirit of Gamer
      else if (/\b(msi|gigabyte|be\s*quiet|phanteks|montech|antec|kolink|cougar|hyte|apnx|havn|razer|gamdias|nox|azza|itek|spirit\s*of\s*gamer|m\.red)\b/.test(n)) form_factor = 'ATX';
      // Mars Gaming — small models are mATX, rest ATX
      else if (/\bmars\s*gaming\b/.test(n)) {
        if (/\b(mc[sz]1?|mcm|mcv|mck|mca|mc-[a-z]|mcpu|mf3d|mfx)\b/.test(nm)) form_factor = 'mATX';
        else form_factor = 'ATX';
      }
      // Generic fallback: "tower" in name → ATX
      else if (/\btower\b/.test(n)) form_factor = 'ATX';
      // Connect brand (Moroccan) — all ATX
      else if (/\bconnect\b/.test(n)) form_factor = 'ATX';
      // Hybrok, Deskooze, Galax/Xtrmlab, FSP, Yeyian — all ATX
      else if (/\b(hybrok|deskooze|galax|xtrmlab|fsp|yeyian)\b/.test(n)) form_factor = 'ATX';
      // Setup Game brand (Moroccan retailer cases) — all ATX
      else if (/\bsetup\s*game\b/.test(n) || /\bsg\s+(airface|airflow|apollo|blader|comet|duomesh|fire|glass|glory|pro|ultra)\b/.test(n)) form_factor = 'ATX';
      // M.RED brand — all ATX
      else if (/\bm\.red\b/.test(n) || /\b(destroyer|stealth\s*fighter|death\s*storm)\b/.test(n)) form_factor = 'ATX';
      // Icelil brand — ATX
      else if (/\bicelil\b/.test(n)) form_factor = 'ATX';
    }

    if (!form_factor) continue;

    await sql`
      UPDATE components SET form_factor = ${form_factor}, updated_at = NOW()
      WHERE id = ${id}
    `;
    updated++;
  }
  console.log(`Case: ${updated}/${rows.length} updated`);
  total += updated;
}

// ── GPU: chipset from name (remaining gaps) ───────────────────────────────────

async function backfillGpuChipset() {
  const rows = (await sql`
    SELECT id, name, brand FROM components
    WHERE category = 'gpu' AND is_active = true AND chipset IS NULL
  `) as { id: number; name: string; brand: string | null }[];

  let updated = 0;
  for (const { id, name } of rows) {
    const n = norm(name);

    let chipset: string | null = null;
    // NVIDIA
    const rtxMatch = n.match(/\b(rtx)\s*(\d{4})\s*(ti\s*super|ti|super)?\b/);
    const gtxMatch = n.match(/\b(gtx)\s*(\d{4})\s*(ti|super)?\b/);
    const gtMatch = n.match(/\b(gt)\s*(\d{3,4})\b/);
    // AMD
    const rxMatch = n.match(/\brx\s*(\d{3,4})\s*(xtx|xt|gre|m)?\b/);
    // Intel Arc
    const arcMatch = n.match(/\barc\s*([ab]\d{3})\b/);

    if (rtxMatch) {
      const suffix = rtxMatch[3] ? ' ' + rtxMatch[3].trim() : '';
      chipset = `GeForce RTX ${rtxMatch[2]}${suffix}`;
    } else if (gtxMatch) {
      const suffix = gtxMatch[3] ? ' ' + gtxMatch[3] : '';
      chipset = `GeForce GTX ${gtxMatch[2]}${suffix}`;
    } else if (gtMatch) {
      chipset = `GeForce GT ${gtMatch[2]}`;
    } else if (rxMatch) {
      const suffix = rxMatch[2] ? ' ' + rxMatch[2].toUpperCase() : '';
      chipset = `Radeon RX ${rxMatch[1]}${suffix}`;
    } else if (arcMatch) {
      chipset = `Arc ${arcMatch[1].toUpperCase()}`;
    }

    if (!chipset) continue;

    await sql`
      UPDATE components SET chipset = ${chipset}, updated_at = NOW()
      WHERE id = ${id}
    `;
    updated++;
  }
  console.log(`GPU chipset: ${updated}/${rows.length} updated`);
  total += updated;
}

// ── RAM: capacity_gb from name ────────────────────────────────────────────────

async function backfillRamCapacity() {
  const rows = (await sql`
    SELECT id, name FROM components
    WHERE category = 'ram' AND is_active = true AND capacity_gb IS NULL
  `) as { id: number; name: string }[];

  let updated = 0;
  for (const { id, name } of rows) {
    const n = norm(name);
    // Take the largest GB number in the name — that's total kit capacity
    const allMatches = [...n.matchAll(/\b(\d+)\s*[Gg][BbOo]\b/g)];
    if (allMatches.length === 0) continue;
    const capacity_gb = Math.max(...allMatches.map(m => parseInt(m[1])));
    if (!capacity_gb || capacity_gb < 1) continue;

    await sql`
      UPDATE components SET capacity_gb = ${capacity_gb}, updated_at = NOW()
      WHERE id = ${id}
    `;
    updated++;
  }
  console.log(`RAM capacity: ${updated}/${rows.length} updated`);
  total += updated;
}

// ── CPU: tdp heuristic by socket/series ──────────────────────────────────────

async function backfillCpuTdp() {
  const rows = (await sql`
    SELECT id, name, socket FROM components
    WHERE category = 'cpu' AND is_active = true AND tdp IS NULL
  `) as { id: number; name: string; socket: string | null }[];

  let updated = 0;
  for (const { id, name, socket } of rows) {
    const n = norm(name);

    // Heuristic TDP by model pattern
    let tdp: number | null = null;

    // Intel K/KF/KS = 125W, F/non-K = 65W, i9 = 125W
    if (/\bcore\s*i9\b/.test(n)) tdp = 125;
    else if (/\b\d{4,5}k[fs]?\b/.test(n)) tdp = 125;
    else if (/\bcore\s*ultra\s*[579]\b/.test(n)) tdp = 125;
    else if (/\bcore\s*i[357]\b/.test(n)) tdp = 65;
    else if (/\bcore\s*i3\b/.test(n)) tdp = 58;
    // AMD Ryzen 9 = 105-170W, Ryzen 7 = 65-105W, Ryzen 5 = 65W
    else if (/\bryzen\s*9\b/.test(n) && /\bx3d\b/.test(n)) tdp = 120;
    else if (/\bryzen\s*9\b/.test(n)) tdp = 105;
    else if (/\bryzen\s*7\b/.test(n) && /\bx3d\b/.test(n)) tdp = 120;
    else if (/\bryzen\s*7\b/.test(n)) tdp = 65;
    else if (/\bryzen\s*5\b/.test(n)) tdp = 65;
    else if (/\bryzen\s*3\b/.test(n)) tdp = 65;

    if (!tdp) continue;

    await sql`
      UPDATE components SET tdp = ${tdp}, updated_at = NOW()
      WHERE id = ${id}
    `;
    updated++;
  }
  console.log(`CPU TDP: ${updated}/${rows.length} updated`);
  total += updated;
}

// ── Motherboard: form_factor from name ───────────────────────────────────────

async function backfillMotherboardFormFactor() {
  const rows = (await sql`
    SELECT id, name FROM components
    WHERE category = 'motherboard' AND is_active = true AND form_factor IS NULL
  `) as { id: number; name: string }[];

  let updated = 0;
  for (const { id, name } of rows) {
    const n = norm(name);

    let form_factor: string | null = null;
    if (/\b(mini.?itx|mini\s*itx)\b/.test(n)) form_factor = 'Mini-ITX';
    else if (/\b(micro.?atx|matx|m.?atx|microatx)\b/.test(n)) form_factor = 'mATX';
    else if (/\b(e.?atx|eatx|extended\s*atx)\b/.test(n)) form_factor = 'E-ATX';
    else if (/\batx\b/.test(n)) form_factor = 'ATX';
    // Infer from chipset suffix: M = mATX, I = ITX
    else if (/\b[abxhz]\d{3,4}m\b/.test(n)) form_factor = 'mATX';
    else if (/\b[abxhz]\d{3,4}i\b/.test(n)) form_factor = 'Mini-ITX';

    if (!form_factor) continue;

    await sql`
      UPDATE components SET form_factor = ${form_factor}, updated_at = NOW()
      WHERE id = ${id}
    `;
    updated++;
  }
  console.log(`Motherboard form_factor: ${updated}/${rows.length} updated`);
  total += updated;
}

// ── Run all ───────────────────────────────────────────────────────────────────

console.log('=== Backfilling parseable gaps (Round 4 — final targeted pass) ===\n');

await backfillStorage();
await backfillPsu();
await backfillCase();

// Fix misclassified entries in case table
const misclassified = (await sql`
  SELECT id, name FROM components
  WHERE category = 'case' AND is_active = true
    AND (name ILIKE '%wraith%' OR name ILIKE '%ryzen%' OR name ILIKE '%cpu%cooler%')
`) as { id: number; name: string }[];

for (const { id, name } of misclassified) {
  await sql`UPDATE components SET is_active = false WHERE id = ${id}`;
  console.log(`Deactivated misclassified case entry: [${id}] "${name}"`);
}

console.log(`\n=== Done. Total rows updated: ${total} ===`);
process.exit(0);
 
