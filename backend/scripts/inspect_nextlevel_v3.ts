import { fetch } from 'undici';
import * as cheerio from 'cheerio';

const res = await fetch('https://nextlevelpc.ma/categorie-produit/processeur', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  },
});

const html = await res.text();
const $ = cheerio.load(html);

// Extract the ItemList JSON-LD (script 4)
const scripts = $('script[type="application/ld+json"]').toArray();
for (const el of scripts) {
  const content = $(el).html() ?? '';
  try {
    const data = JSON.parse(content);
    if (data['@type'] === 'ItemList') {
      console.log('Found ItemList with', data.itemListElement?.length, 'items');
      console.log('First item:', JSON.stringify(data.itemListElement?.[0], null, 2));
      console.log('Second item:', JSON.stringify(data.itemListElement?.[1], null, 2));
      break;
    }
  } catch { /* skip */ }
}
