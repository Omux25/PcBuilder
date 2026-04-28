import { fetch } from 'undici';
import * as cheerio from 'cheerio';

const url = 'https://nextlevelpc.ma/processeur/94751-intel-core-i5-14400f-jusqua-47-ghz-tray.html';
const res = await fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
});
const html = await res.text();
const $ = cheerio.load(html);

console.log('=== All span.price elements ===');
$('span.price').each((i, el) => {
  console.log(`  [${i}] "${$(el).text().trim()}"`);
});

console.log('\n=== Badge text ===');
$('.badge-name-text').each((i, el) => {
  console.log(`  [${i}] "${$(el).text().trim()}"`);
});

console.log('\n=== "Demander un devis" button ===');
$('button, a').each((i, el) => {
  const text = $(el).text().trim();
  if (text.toLowerCase().includes('devis') || text.toLowerCase().includes('quote')) {
    console.log(`  "${text}"`);
  }
});

console.log('\n=== JSON-LD product data ===');
$('script[type="application/ld+json"]').each((i, el) => {
  try {
    const data = JSON.parse($(el).html() ?? '');
    if (data['@type'] === 'Product') {
      console.log(`  Name: ${data.name}`);
      console.log(`  Offers: ${JSON.stringify(data.offers)}`);
    }
  } catch {}
});

process.exit(0);
