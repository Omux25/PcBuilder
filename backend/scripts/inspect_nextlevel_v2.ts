/**
 * Inspect NextLevelPC HTML to find JSON-LD and correct CSS selectors.
 * Saves raw HTML to file for manual inspection.
 */
import { fetch } from 'undici';
import * as cheerio from 'cheerio';
import { writeFile } from 'fs/promises';

const res = await fetch('https://nextlevelpc.ma/categorie-produit/processeur', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9',
  },
});

const html = await res.text();
await writeFile('/tmp/nextlevel.html', html);
console.log(`Saved ${html.length} bytes to /tmp/nextlevel.html`);

const $ = cheerio.load(html);

// Check for JSON-LD
console.log('\n=== JSON-LD scripts ===');
$('script[type="application/ld+json"]').each((i, el) => {
  const content = $(el).html() ?? '';
  console.log(`Script ${i}: ${content.slice(0, 200)}`);
});

// Check for __NEXT_DATA__
const nextData = $('#__NEXT_DATA__').html();
if (nextData) {
  console.log('\n=== __NEXT_DATA__ found ===');
  console.log(nextData.slice(0, 500));
}

// Find all unique class names on elements containing price text
console.log('\n=== Elements with price text ===');
const seen = new Set<string>();
$('*').each((_i, el) => {
  const text = $(el).text().trim();
  if (text.match(/\d[\s\d]*,\d{2}\s*MAD/) && $(el).children().length === 0) {
    const cls = $(el).attr('class') ?? el.tagName;
    if (!seen.has(cls)) {
      seen.add(cls);
      console.log(`  <${el.tagName} class="${cls}"> "${text.slice(0, 40)}"`);
    }
  }
});

// Find product links
console.log('\n=== Links to /produit/ ===');
$('a').each((_i, el) => {
  const href = $(el).attr('href') ?? '';
  if (href.includes('/produit/')) {
    const text = $(el).text().trim().slice(0, 60);
    const cls = $(el).attr('class') ?? '';
    console.log(`  href="${href.slice(0, 80)}" class="${cls}" text="${text}"`);
  }
}).slice(0, 10);
