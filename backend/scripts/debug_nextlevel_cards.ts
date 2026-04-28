/**
 * Check if product cards on NextLevel have prices directly in them.
 */
import { fetch } from 'undici';
import * as cheerio from 'cheerio';

const url = 'https://nextlevelpc.ma/165-processeur';
const res = await fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
});
const html = await res.text();
const $ = cheerio.load(html);

// Check product cards
let cardCount = 0;
$('article.product-miniature').each((i, card) => {
  const url = $(card).find('a[itemprop="url"], a.product-thumbnail').first().attr('href') ?? '';
  const name = $(card).find('[itemprop="name"]').first().text().trim() ||
               $(card).find('.product-title').first().text().trim();
  const priceEl = $(card).find('span.price').first().text().trim();
  const badge = $(card).find('.badge-name-text').first().text().trim();

  if (i < 25) {
    console.log(`[${i}] ${badge.padEnd(15)} | ${priceEl.padEnd(18)} | ${name.slice(0, 50)}`);
    if (url.includes('14400f')) console.log(`  ← TARGET URL: ${url}`);
  }
  cardCount++;
});

console.log(`\nTotal cards: ${cardCount}`);

process.exit(0);
