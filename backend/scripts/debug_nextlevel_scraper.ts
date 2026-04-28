/**
 * Debug the NextLevel scraper pagination detection.
 */
import { fetch } from 'undici';
import * as cheerio from 'cheerio';

const URL = 'https://nextlevelpc.ma/165-processeur';

const res = await fetch(URL, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
});
const html = await res.text();
const $ = cheerio.load(html);

// Test the exact selector the scraper uses
console.log('=== Pagination link selector: a[href*="page="] ===');
const pageLinks: string[] = [];
$('a[href*="page="]').each((_i, el) => {
  const href = $(el).attr('href') ?? '';
  pageLinks.push(href);
});
console.log(`Found ${pageLinks.length} links with "page=" in href:`);
pageLinks.forEach(l => console.log(`  ${l}`));

// Test the regex
const pageNums: number[] = [];
$('a[href*="page="]').each((_i, el) => {
  const href = $(el).attr('href') ?? '';
  const m = href.match(/[?&]page=(\d+)/);
  if (m) pageNums.push(parseInt(m[1]));
});
console.log(`\nExtracted page numbers: ${pageNums}`);
console.log(`Max page: ${pageNums.length > 0 ? Math.max(...pageNums) : 'NONE - pagination not detected!'}`);

// Check what the total products count says
const totalText = $('.total-products').text().trim();
console.log(`\nTotal products text: "${totalText}"`);

// Check if there's a different pagination element
console.log('\n=== All pagination-related elements ===');
$('[class*="pagination"], [class*="pager"], nav').each((_i, el) => {
  const cls = $(el).attr('class') ?? $(el).prop('tagName');
  const text = $(el).text().trim().slice(0, 100);
  console.log(`  [${cls}]: "${text}"`);
});

// Check the actual page number links more carefully
console.log('\n=== All <a> tags with numbers in href ===');
$('a').each((_i, el) => {
  const href = $(el).attr('href') ?? '';
  if (href.includes('page=') || href.match(/\/\d+$/)) {
    console.log(`  "${href}"`);
  }
});

process.exit(0);
