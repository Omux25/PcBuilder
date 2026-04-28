/**
 * Debug the NextLevel category listing price pairing.
 * Check if JSON-LD products and span.price elements are in sync.
 */
import { fetch } from 'undici';
import * as cheerio from 'cheerio';

// Fetch the CPU category page
const url = 'https://nextlevelpc.ma/165-processeur?page=5'; // page where i5-14400F appears
const res = await fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
});
const html = await res.text();
const $ = cheerio.load(html);

// Extract JSON-LD products
const jsonLdProducts: { name: string; url: string }[] = [];
$('script[type="application/ld+json"]').each((_i, el) => {
  try {
    const data = JSON.parse($(el).html() ?? '');
    if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
      for (const item of data.itemListElement) {
        if (item.item?.['@type'] === 'Product') {
          jsonLdProducts.push({ name: item.item.name, url: item.item.url });
        }
      }
    }
  } catch {}
});

// Extract all span.price elements
const allPriceEls: string[] = [];
$('span.price').each((_i, el) => {
  const text = $(el).text().trim();
  if (text.match(/\d[\s\d]*,\d{2}/)) allPriceEls.push(text);
});

// Deduplicate consecutive
const uniquePrices: string[] = [];
for (let i = 0; i < allPriceEls.length; i++) {
  if (i === 0 || allPriceEls[i] !== allPriceEls[i - 1]) uniquePrices.push(allPriceEls[i]);
}

console.log(`JSON-LD products: ${jsonLdProducts.length}`);
console.log(`Unique prices: ${uniquePrices.length}`);
console.log(`All price elements: ${allPriceEls.length}`);

// Show the pairing
console.log('\n=== Product → Price pairing ===');
for (let i = 0; i < Math.min(jsonLdProducts.length, 25); i++) {
  const product = jsonLdProducts[i];
  const price = uniquePrices[i] ?? 'MISSING';
  const flag = product.name.includes('14400F') ? ' ← TARGET' : '';
  console.log(`  [${i}] ${price.padEnd(15)} | ${product.name}${flag}`);
}

// Show all price elements raw
console.log('\n=== All price elements (raw) ===');
allPriceEls.forEach((p, i) => console.log(`  [${i}] "${p}"`));

process.exit(0);
