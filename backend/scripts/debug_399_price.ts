/**
 * Find which NextLevel page has the i5-14400F and what price it shows.
 */
import { fetch } from 'undici';
import * as cheerio from 'cheerio';

const BASE = 'https://nextlevelpc.ma/165-processeur';

// Find which page has the i5-14400F
for (let page = 1; page <= 10; page++) {
  const url = page === 1 ? BASE : `${BASE}?page=${page}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  // Check JSON-LD for i5-14400F
  let found = false;
  let foundIndex = -1;
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

  for (let i = 0; i < jsonLdProducts.length; i++) {
    if (jsonLdProducts[i].name.includes('14400F') && jsonLdProducts[i].name.includes('TRAY')) {
      found = true;
      foundIndex = i;
    }
  }

  if (found) {
    console.log(`Found on page ${page}, index ${foundIndex}`);

    // Get prices
    const allPriceEls: string[] = [];
    $('span.price').each((_i, el) => {
      const text = $(el).text().trim();
      if (text.match(/\d[\s\d]*,\d{2}/)) allPriceEls.push(text);
    });

    const uniquePrices: string[] = [];
    for (let i = 0; i < allPriceEls.length; i++) {
      if (i === 0 || allPriceEls[i] !== allPriceEls[i - 1]) uniquePrices.push(allPriceEls[i]);
    }

    console.log(`Total JSON-LD products: ${jsonLdProducts.length}`);
    console.log(`Total unique prices: ${uniquePrices.length}`);
    console.log(`All price elements: ${allPriceEls.length}`);

    // Show pairing around the target
    console.log('\n=== Pairing around i5-14400F ===');
    for (let i = Math.max(0, foundIndex - 3); i < Math.min(jsonLdProducts.length, foundIndex + 5); i++) {
      const price = uniquePrices[i] ?? 'MISSING';
      const flag = i === foundIndex ? ' ← i5-14400F TRAY' : '';
      console.log(`  [${i}] ${price.padEnd(18)} | ${jsonLdProducts[i].name}${flag}`);
    }

    // Show raw price elements around the target
    const rawStart = foundIndex * 3;
    console.log(`\n=== Raw price elements [${rawStart}..${rawStart+5}] ===`);
    for (let i = rawStart; i < Math.min(allPriceEls.length, rawStart + 6); i++) {
      console.log(`  [${i}] "${allPriceEls[i]}"`);
    }

    break;
  }
}

process.exit(0);
