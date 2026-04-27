import { fetch } from 'undici';
import * as cheerio from 'cheerio';

const res = await fetch('https://nextlevelpc.ma/categorie-produit/processeur', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  },
});

const html = await res.text();
const $ = cheerio.load(html);

// Find all elements that contain price-like text
console.log('=== Elements containing MAD ===');
$('*').each((_i, el) => {
  const text = $(el).text();
  if (text.includes('MAD') && text.length < 50 && $(el).children().length === 0) {
    console.log(`  <${el.tagName} class="${$(el).attr('class') ?? ''}"> ${text.trim()}`);
  }
});

// Find product links
console.log('\n=== Product links ===');
$('a[href*="/produit/"]').slice(0, 5).each((_i, el) => {
  console.log(`  href="${$(el).attr('href')}" text="${$(el).text().trim().slice(0, 60)}"`);
});

// Find all li and article elements
console.log('\n=== Product containers ===');
$('li, article').slice(0, 3).each((_i, el) => {
  const cls = $(el).attr('class') ?? '';
  if (cls.includes('product') || cls.includes('item')) {
    console.log(`  <${el.tagName} class="${cls}">`);
  }
});
