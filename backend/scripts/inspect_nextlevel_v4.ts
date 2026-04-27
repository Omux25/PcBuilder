import { fetch } from 'undici';
import * as cheerio from 'cheerio';

const res = await fetch('https://nextlevelpc.ma/categorie-produit/processeur', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  },
});

const html = await res.text();
const $ = cheerio.load(html);

// Find all product links (not /produit/ but category-based URLs)
console.log('=== All links containing product IDs ===');
$('a[href]').each((_i, el) => {
  const href = $(el).attr('href') ?? '';
  // NextLevel uses /category/ID-slug.html pattern
  if (href.match(/nextlevelpc\.ma\/[a-z-]+\/\d+-[a-z]/)) {
    const text = $(el).text().trim().slice(0, 60);
    const cls = $(el).attr('class') ?? '';
    if (text) console.log(`  href="${href}" class="${cls}" text="${text}"`);
  }
}).slice(0, 10);

// Find the parent container of span.price
console.log('\n=== Parent of span.price ===');
$('span.price').slice(0, 3).each((_i, el) => {
  const parent = $(el).parent();
  const grandparent = parent.parent();
  const ggp = grandparent.parent();
  console.log(`  price="${$(el).text().trim()}"`);
  console.log(`  parent: <${parent[0].tagName} class="${parent.attr('class') ?? ''}">`);
  console.log(`  grandparent: <${grandparent[0].tagName} class="${grandparent.attr('class') ?? ''}">`);
  console.log(`  great-grandparent: <${ggp[0].tagName} class="${ggp.attr('class') ?? ''}">`);
  // Find nearest link ancestor
  const link = $(el).closest('a');
  if (link.length) console.log(`  nearest link: href="${link.attr('href')}"`);
  console.log('---');
});
