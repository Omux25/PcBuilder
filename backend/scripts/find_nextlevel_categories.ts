import { fetch } from 'undici';
import * as cheerio from 'cheerio';

const res = await fetch('https://nextlevelpc.ma/categorie-produit/composants', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
});
const html = await res.text();
const $ = cheerio.load(html);

// Find ALL links
console.log('=== All links ===');
const seen = new Set<string>();
$('a[href]').each((_i, el) => {
  const href = $(el).attr('href') ?? '';
  const text = $(el).text().trim();
  if (href.includes('nextlevelpc') && !seen.has(href) && text.length < 60 && text.length > 2) {
    seen.add(href);
    console.log(`  ${href} — "${text}"`);
  }
});
