/**
 * time_scrapers.ts — measures how long each scraper and each category takes.
 * Run: bun run scripts/time_scrapers.ts
 */

import { fetch } from 'undici';
import * as cheerio from 'cheerio';
import { UltraPcScraper } from '../scraper/scrapers/ultrapcScraper.js';
import { SetupGameScraper } from '../scraper/scrapers/setupgameScraper.js';
import { BaseScraper, type ScrapedPrice } from '../scraper/scrapers/baseScraper.js';
import type { CheerioAPI } from 'cheerio';

function ms(start: number) { return `${((Date.now() - start) / 1000).toFixed(1)}s`; }

// ── UltraPC ───────────────────────────────────────────────────────────────────
console.log('\n=== UltraPC ===');
const ultraStart = Date.now();
try {
  const products = await new UltraPcScraper().scrapeAllCategories();
  console.log(`✓ ${products.length} products in ${ms(ultraStart)}`);
} catch (e) {
  console.log(`✗ FAILED in ${ms(ultraStart)}: ${(e as Error).message}`);
}

// ── NextLevel — per-category timing ──────────────────────────────────────────
console.log('\n=== NextLevel (per category) ===');

const NEXTLEVEL_CATEGORIES = [
  { url: 'https://nextlevelpc.ma/165-processeur',           label: 'CPU' },
  { url: 'https://nextlevelpc.ma/144-carte-graphique-video-gpu', label: 'GPU' },
  { url: 'https://nextlevelpc.ma/169-carte-mere',           label: 'Motherboard' },
  { url: 'https://nextlevelpc.ma/181-memoire-ram',          label: 'RAM' },
  { url: 'https://nextlevelpc.ma/250-disques-durs',         label: 'Storage' },
  { url: 'https://nextlevelpc.ma/179-alimentation-pc-psu',  label: 'PSU' },
  { url: 'https://nextlevelpc.ma/253-boitier-gamer',        label: 'Case' },
  { url: 'https://nextlevelpc.ma/269-cpu-cooler',           label: 'Cooling' },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
};

let nextTotal = 0;
const nextStart = Date.now();

for (const { url, label } of NEXTLEVEL_CATEGORIES) {
  const catStart = Date.now();
  process.stdout.write(`  [${label}] fetching page 1... `);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal } as any);
    clearTimeout(timeout);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Count JSON-LD products
    let productCount = 0;
    $('script[type="application/ld+json"]').each((_i, el) => {
      try {
        const data = JSON.parse($(el).html() ?? '');
        if (data['@type'] === 'ItemList') productCount += data.itemListElement?.length ?? 0;
      } catch {}
    });

    console.log(`HTTP ${res.status} | ${html.length} bytes | ${productCount} products in JSON-LD | ${ms(catStart)}`);
    nextTotal += productCount;
  } catch (e) {
    console.log(`✗ FAILED in ${ms(catStart)}: ${(e as Error).message}`);
  }
}
console.log(`NextLevel total: ~${nextTotal} products in ${ms(nextStart)}`);

// ── SetupGame ─────────────────────────────────────────────────────────────────
console.log('\n=== SetupGame ===');
const sgStart = Date.now();
try {
  const products = await new SetupGameScraper().scrapeAllCategories();
  console.log(`✓ ${products.length} products in ${ms(sgStart)}`);
} catch (e) {
  console.log(`✗ FAILED in ${ms(sgStart)}: ${(e as Error).message}`);
}

console.log(`\nDone in ${ms(ultraStart)}`);
