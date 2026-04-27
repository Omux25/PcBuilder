/**
 * Quick verification that all 3 scrapers return real data from live sites.
 */
import { UltraPcScraper } from '../scraper/scrapers/ultrapcScraper.js';
import { NextLevelScraper } from '../scraper/scrapers/nextlevelScraper.js';
import { SetupGameScraper } from '../scraper/scrapers/setupgameScraper.js';
import { fetch } from 'undici';

// ── UltraPC ───────────────────────────────────────────────────────────────────
try {
  const ultrapc = new UltraPcScraper();
  // Use the internal method by calling scrapeCategory via scrapeAllCategories
  // but limit to one category by temporarily overriding
  const res = await fetch('https://www.ultrapc.ma/21-processeurs?page=1', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
  });
  const text = await res.text();
  const match = text.match(/"products"\s*:\s*(\[[\s\S]*?\])\s*,\s*"sort_orders"/);
  if (match) {
    const products = JSON.parse(match[1]);
    console.log(`OK   UltraPC: ${products.length} products on CPU page`);
    if (products[0]) console.log(`     Sample: "${products[0].name}" | ${products[0].price_amount} MAD`);
  } else {
    console.log('FAIL UltraPC: could not parse product data');
  }
} catch (err) {
  console.log(`FAIL UltraPC: ${(err as Error).message}`);
}

// ── NextLevel ─────────────────────────────────────────────────────────────────
try {
  const nextlevel = new NextLevelScraper();
  const results = await nextlevel.scrape('https://nextlevelpc.ma/165-processeur');
  if (results.length > 0) {
    console.log(`OK   NextLevel: ${results.length} products on CPU page`);
    console.log(`     Sample: "${results[0].product_name}" | ${results[0].price} MAD | ${results[0].in_stock ? 'in stock' : 'out of stock'}`);
  } else {
    console.log('FAIL NextLevel: 0 products returned');
  }
} catch (err) {
  console.log(`FAIL NextLevel: ${(err as Error).message}`);
}

// ── SetupGame ─────────────────────────────────────────────────────────────────
try {
  const res = await fetch('https://setupgame.ma/wp-json/wc/store/v1/products?category=86&per_page=5&page=1', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Origin': 'https://setupgame.ma',
      'Referer': 'https://setupgame.ma/',
    },
  });
  const data = await res.json() as any[];
  if (Array.isArray(data) && data.length > 0) {
    const price = parseInt(data[0].prices.price) / Math.pow(10, data[0].prices.currency_minor_unit);
    console.log(`OK   SetupGame: ${data.length} products on CPU page`);
    console.log(`     Sample: "${data[0].name}" | ${price} MAD | ${data[0].is_in_stock ? 'in stock' : 'out of stock'}`);
  } else {
    console.log(`FAIL SetupGame: unexpected response — ${JSON.stringify(data).slice(0, 100)}`);
  }
} catch (err) {
  console.log(`FAIL SetupGame: ${(err as Error).message}`);
}

// ── DB check ──────────────────────────────────────────────────────────────────
import { sql } from 'bun';
const mappings = await sql`SELECT retailer_id, COUNT(id) AS cnt FROM scraper_mappings GROUP BY retailer_id ORDER BY retailer_id` as { retailer_id: number; cnt: string }[];
const prices = await sql`SELECT retailer_id, COUNT(id) AS cnt FROM prices GROUP BY retailer_id ORDER BY retailer_id` as { retailer_id: number; cnt: string }[];
const retailers = await sql`SELECT id, name FROM retailers WHERE id IN (10, 11, 13)` as { id: number; name: string }[];

console.log('\n=== Database Status ===');
for (const r of retailers) {
  const m = mappings.find((x) => x.retailer_id === r.id);
  const p = prices.find((x) => x.retailer_id === r.id);
  console.log(`  ${r.name} (id=${r.id}): ${m?.cnt ?? 0} mappings, ${p?.cnt ?? 0} prices`);
}
