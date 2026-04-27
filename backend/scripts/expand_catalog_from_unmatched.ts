/**
 * Catalog expansion script — auto-generates catalog entries from unmatched UltraPC products.
 *
 * Strategy:
 * 1. Fetch all unmatched UltraPC products that look like real PC components
 * 2. Parse the product name to extract brand, model, and category-specific specs
 * 3. Deduplicate (multiple AIB variants of the same GPU → one catalog entry)
 * 4. Insert new catalog entries
 * 5. Re-run auto-mapping to link the new entries
 *
 * This is not perfect — it creates catalog entries from retailer names which may
 * have inconsistent formatting. But it dramatically increases coverage.
 *
 * Run with: bun run scripts/expand_catalog_from_unmatched.ts
 */

import { sql } from 'bun';
import { componentSlug, generateUniqueSlug } from '../src/utils/slugify.js';

// ── Parsers ───────────────────────────────────────────────────────────────────

interface ParsedComponent {
  brand: string;
  name: string;
  category: string;
  specs: Record<string, unknown>;
  slug?: string;
}

function parseGpu(productName: string): ParsedComponent | null {
  // Extract GPU chip model: RTX 4090, RTX 5080, RX 7900 XTX, etc.
  const rtxMatch = productName.match(/RTX\s+(\d{4}(?:\s*(?:Ti|SUPER|XTX|XT))?)/i);
  const rxMatch  = productName.match(/RX\s+(\d{4}(?:\s*(?:XTX|XT|GRE))?)/i);
  const gtxMatch = productName.match(/GTX\s+(\d{4}(?:\s*Ti)?)/i);

  let chipModel: string | null = null;
  let brand = 'NVIDIA';

  if (rtxMatch) {
    chipModel = `RTX ${rtxMatch[1].trim()}`;
  } else if (rxMatch) {
    chipModel = `RX ${rxMatch[1].trim()}`;
    brand = 'AMD';
  } else if (gtxMatch) {
    chipModel = `GTX ${gtxMatch[1].trim()}`;
  }

  if (!chipModel) return null;

  // Extract VRAM
  const vramMatch = productName.match(/(\d+)\s*Go\s*GDDR/i) || productName.match(/(\d+)GB/i);
  const vram_gb = vramMatch ? parseInt(vramMatch[1]) : null;

  // Estimate TDP based on model
  const tdpMap: Record<string, number> = {
    'RTX 5090': 575, 'RTX 5080': 360, 'RTX 5070 Ti': 300, 'RTX 5070': 250,
    'RTX 4090': 450, 'RTX 4080': 320, 'RTX 4070 Ti': 285, 'RTX 4070 SUPER': 220,
    'RTX 4070': 200, 'RTX 4060 Ti': 165, 'RTX 4060': 115,
    'RTX 3090': 350, 'RTX 3080': 320, 'RTX 3070': 220, 'RTX 3060 Ti': 200, 'RTX 3060': 170,
    'RX 7900 XTX': 355, 'RX 7900 XT': 315, 'RX 7800 XT': 263, 'RX 7700 XT': 245,
    'RX 7600 XT': 190, 'RX 7600': 165, 'RX 6800 XT': 300, 'RX 6700 XT': 230,
  };

  const tdp = tdpMap[chipModel] ?? null;

  // Estimate length
  const lengthMap: Record<string, number> = {
    'RTX 5090': 360, 'RTX 5080': 336, 'RTX 4090': 336, 'RTX 4080': 336,
    'RTX 4070 Ti': 285, 'RTX 4070 SUPER': 244, 'RTX 4070': 244,
    'RTX 4060 Ti': 240, 'RTX 4060': 240,
    'RX 7900 XTX': 287, 'RX 7900 XT': 287, 'RX 7800 XT': 267, 'RX 7700 XT': 267,
    'RX 7600 XT': 200, 'RX 7600': 200,
  };
  const length_mm = lengthMap[chipModel] ?? 280;

  const name = `GeForce ${chipModel}`;
  const fullName = brand === 'AMD' ? `Radeon ${chipModel}` : `GeForce ${chipModel}`;

  return {
    brand,
    name: fullName,
    category: 'gpu',
    specs: {
      chipset: chipModel,
      vram_gb: vram_gb ?? 8,
      length_mm,
      tdp: tdp ?? 200,
      pcie_version: '4.0',
    },
  };
}

function parseCpu(productName: string): ParsedComponent | null {
  // AMD Ryzen patterns
  const ryzenMatch = productName.match(/AMD\s+Ryzen\s+(\d+)\s+(\w+)/i);
  // Intel Core patterns
  const intelMatch = productName.match(/Intel\s+Core\s+(i\d|Ultra\s+\d+)\s+(\w+)/i);

  if (ryzenMatch) {
    const series = ryzenMatch[1];
    const model = ryzenMatch[2];
    const fullModel = `Ryzen ${series} ${model}`;

    // Determine socket from model number
    const modelNum = parseInt(model.replace(/[^0-9]/g, ''));
    const socket = modelNum >= 7000 ? 'AM5' : 'AM4';

    // Estimate TDP
    const tdp = model.includes('X3D') ? 120 : model.includes('X') ? 105 : 65;

    return {
      brand: 'AMD',
      name: fullModel,
      category: 'cpu',
      specs: {
        socket,
        cores: series === '3' ? 4 : series === '5' ? 6 : series === '7' ? 8 : 12,
        threads: series === '3' ? 8 : series === '5' ? 12 : series === '7' ? 16 : 24,
        tdp,
      },
    };
  }

  if (intelMatch) {
    const tier = intelMatch[1];
    const model = intelMatch[2];
    const fullModel = `Core ${tier} ${model}`;

    const socket = tier.startsWith('Ultra') ? 'LGA1851' : 'LGA1700';
    const tdp = model.includes('K') ? 125 : 65;

    return {
      brand: 'Intel',
      name: fullModel,
      category: 'cpu',
      specs: { socket, tdp },
    };
  }

  return null;
}

function parseRam(productName: string): ParsedComponent | null {
  const ddrMatch = productName.match(/(DDR[45])[- ]?(\d+)\s+(\d+)\s*Go/i) ||
                   productName.match(/(DDR[45])[- ]?(\d+)\s+(\d+)\s*GB/i);

  if (!ddrMatch) return null;

  const ram_type = ddrMatch[1].toUpperCase() as 'DDR4' | 'DDR5';
  const frequency_mhz = parseInt(ddrMatch[2]);
  const capacity_gb = parseInt(ddrMatch[3]);

  // Extract brand
  const brandMatch = productName.match(/^(Corsair|G\.Skill|Kingston|TeamGroup|Crucial|Lexar|Patriot|PNY|Adata)/i);
  const brand = brandMatch ? brandMatch[1] : 'Generic';

  // Extract kit name
  const kitMatch = productName.match(/(Vengeance|Trident|Fury|Ripjaws|T-Force|Delta|Flare|Dominator|Viper|Ares)/i);
  const kitName = kitMatch ? kitMatch[1] : ram_type;

  const name = `${kitName} ${capacity_gb}GB ${ram_type}-${frequency_mhz}`;

  return {
    brand,
    name,
    category: 'ram',
    specs: {
      ram_type,
      capacity_gb,
      frequency_mhz,
      cas_latency: ram_type === 'DDR5' ? 36 : 16,
      voltage: ram_type === 'DDR5' ? 1.1 : 1.35,
    },
  };
}

function parseSsd(productName: string): ParsedComponent | null {
  const capacityMatch = productName.match(/(\d+)\s*(?:Go|GB|To|TB)/i);
  if (!capacityMatch) return null;

  const rawCapacity = parseInt(capacityMatch[1]);
  const unit = capacityMatch[0].toLowerCase();
  const capacity_gb = unit.includes('to') || unit.includes('tb') ? rawCapacity * 1000 : rawCapacity;

  const brandMatch = productName.match(/^(Samsung|WD|Western Digital|Seagate|Kingston|Crucial|Lexar|Corsair|PNY|Adata|Sabrent|Gigabyte)/i);
  const brand = brandMatch ? brandMatch[1] : 'Generic';

  const modelMatch = productName.match(/(980 PRO|990 PRO|990 EVO|970 EVO|SN850X|SN770|SN580|P3|P5|MX500|NV2|KC3000|MP600|MP700)/i);
  const model = modelMatch ? modelMatch[1] : 'NVMe SSD';

  const isNvme = productName.match(/nvme|m\.2|pcie/i);
  const interface_ = isNvme ? 'M.2 PCIe 4.0 x4' : 'SATA 6Gb/s';

  return {
    brand,
    name: `${model} ${capacity_gb >= 1000 ? capacity_gb / 1000 + 'TB' : capacity_gb + 'GB'}`,
    category: 'storage',
    specs: {
      type: isNvme ? 'NVMe SSD' : 'SATA SSD',
      capacity_gb,
      interface: interface_,
      read_speed_mbps: isNvme ? 7000 : 560,
      write_speed_mbps: isNvme ? 6500 : 530,
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching unmatched listings...');

  const unmatched = await sql`
    SELECT DISTINCT scraped_name
    FROM unmatched_listings
    WHERE retailer_id = 10 AND status = 'pending'
      AND (
        scraped_name ILIKE '%rtx%' OR scraped_name ILIKE '%radeon%' OR scraped_name ILIKE '%rx %'
        OR scraped_name ILIKE '%ryzen%' OR scraped_name ILIKE '%core i%' OR scraped_name ILIKE '%core ultra%'
        OR scraped_name ILIKE '%ddr4%' OR scraped_name ILIKE '%ddr5%'
        OR scraped_name ILIKE '%nvme%' OR scraped_name ILIKE '%ssd%'
      )
    ORDER BY scraped_name
  ` as { scraped_name: string }[];

  console.log(`Found ${unmatched.length} distinct unmatched component names.`);

  // Fetch existing slugs to avoid collisions
  const existingSlugs = await sql`SELECT slug FROM components` as { slug: string }[];
  const slugSet = new Set(existingSlugs.map((r) => r.slug));

  const parsed: ParsedComponent[] = [];
  const seen = new Set<string>(); // deduplicate by normalized name

  for (const { scraped_name } of unmatched) {
    let component: ParsedComponent | null = null;

    if (scraped_name.match(/rtx|gtx/i) || scraped_name.match(/radeon|rx \d/i)) {
      component = parseGpu(scraped_name);
    } else if (scraped_name.match(/ryzen|core i|core ultra/i)) {
      component = parseCpu(scraped_name);
    } else if (scraped_name.match(/ddr[45]/i)) {
      component = parseRam(scraped_name);
    } else if (scraped_name.match(/nvme|ssd/i)) {
      component = parseSsd(scraped_name);
    }

    if (!component) continue;

    const key = `${component.brand}-${component.name}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const baseSlug = componentSlug(component.brand, component.name);
    const slug = generateUniqueSlug(baseSlug, slugSet);
    slugSet.add(slug);
    component.slug = slug;
    parsed.push(component);
  }

  console.log(`Parsed ${parsed.length} unique new components to add.`);

  let inserted = 0;
  let failed = 0;

  for (const comp of parsed) {
    try {
      await sql`
        INSERT INTO components (slug, name, brand, category, specs, is_active, release_year)
        VALUES (
          ${comp.slug!},
          ${comp.name},
          ${comp.brand},
          ${comp.category},
          ${JSON.stringify(comp.specs)},
          true,
          2024
        )
        ON CONFLICT (slug) DO NOTHING
      `;
      inserted++;
    } catch (err) {
      failed++;
      if (failed <= 5) console.error(`  Failed: ${comp.name} — ${(err as Error).message}`);
    }
  }

  console.log(`\nInserted: ${inserted} new components`);
  console.log(`Failed:   ${failed}`);

  // Count total components now
  const total = await sql`SELECT COUNT(id) AS cnt FROM components WHERE is_active = true` as { cnt: string }[];
  console.log(`Total catalog size: ${total[0].cnt}`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
