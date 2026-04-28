/**
 * Analyze unmatched listings to find what catalog entries are missing.
 * Groups by likely category based on keywords in the product name.
 */
import { sql } from 'bun';

const pending = await sql`
  SELECT ul.scraped_name, r.name AS retailer
  FROM unmatched_listings ul
  JOIN retailers r ON r.id = ul.retailer_id
  WHERE ul.status = 'pending'
    AND ul.scraped_name IS NOT NULL
    AND ul.scraped_name != ''
  ORDER BY ul.scraped_name
` as { scraped_name: string; retailer: string }[];

// Classify by keyword
function classify(name: string): string {
  const n = name.toLowerCase();
  if (n.match(/\b(ryzen|core i[3579]|core ultra|threadripper|xeon|athlon|pentium|celeron)\b/)) return 'cpu';
  if (n.match(/\b(rtx|gtx|radeon|rx \d{4}|arc [ab]\d{3}|geforce|quadro)\b/)) return 'gpu';
  if (n.match(/\b(b\d{3}|x\d{3}|z\d{3}|h\d{3}|a\d{3}|trx\d{2}|carte.?m[eè]re|motherboard|socket)\b/)) return 'motherboard';
  if (n.match(/\b(ddr[45]|dimm|sodimm|ram|m[eé]moire)\b/)) return 'ram';
  if (n.match(/\b(ssd|nvme|m\.?2|sata|hdd|disque|firecuda|barracuda|ironwolf|wd.?(red|blue|black|green|purple)|crucial.?(bx|mx|p[235])|samsung.?(870|980|990|860))\b/)) return 'storage';
  if (n.match(/\b(\d{3,4}\s*w|watt|alimentation|psu|gold|platinum|titanium|bronze|modular|atx.?\d|focus|prime|straight|rm\d{3}|hx\d{3}|cx\d{3}|mwe|toughpower|superflower)\b/)) return 'psu';
  if (n.match(/\b(boitier|case|tower|mid.?tower|full.?tower|mini.?itx|matx|micro.?atx|tempered|meshify|define|h\d{3}|p\d{3}|o11|lian.?li|fractal|nzxt|corsair.?(4000|5000|7000)|phanteks|be.?quiet.*(pure|silent))\b/)) return 'case';
  if (n.match(/\b(cooler|refroidissement|ventirad|aio|liquid|240mm|280mm|360mm|120mm|noctua|deepcool|be.?quiet|arctic|thermalright|scythe|id.?cooling|enermax|corsair.*(h\d{2,3}|icue))\b/)) return 'cooling';
  if (n.match(/\b(fan|ventilateur|argb|rgb.?fan|case.?fan|pwm.?fan)\b/)) return 'fan (accessory)';
  if (n.match(/\b(cable|câble|adaptateur|adapter|riser|extension)\b/)) return 'cable (accessory)';
  if (n.match(/\b(souris|mouse|clavier|keyboard|casque|headset|écran|monitor|webcam|micro|microphone)\b/)) return 'peripheral (skip)';
  if (n.match(/\b(pâte|paste|thermal|graisse)\b/)) return 'thermal paste (skip)';
  if (n.match(/\b(pack|bundle|kit.*(pc|gaming)|pc.*(gamer|gaming|complet))\b/)) return 'bundle (skip)';
  return 'unknown';
}

const byCategory: Record<string, string[]> = {};
for (const p of pending) {
  const cat = classify(p.scraped_name);
  if (!byCategory[cat]) byCategory[cat] = [];
  byCategory[cat].push(p.scraped_name);
}

console.log('\n=== Unmatched listings by inferred category ===\n');
const sorted = Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length);
for (const [cat, items] of sorted) {
  console.log(`${cat}: ${items.length}`);
}

// Show unique product names for PC component categories (not accessories)
const pcCats = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooling'];
for (const cat of pcCats) {
  const items = byCategory[cat] ?? [];
  if (items.length === 0) continue;
  const unique = [...new Set(items)].sort();
  console.log(`\n=== Missing ${cat.toUpperCase()} entries (${unique.length} unique) ===`);
  unique.slice(0, 20).forEach(n => console.log(`  ${n}`));
  if (unique.length > 20) console.log(`  ... and ${unique.length - 20} more`);
}

process.exit(0);
