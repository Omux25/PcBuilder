/**
 * Inspect NextLevel pagination to understand the real URL structure.
 */
import { fetch } from 'undici';
import * as cheerio from 'cheerio';

const BASE = 'https://nextlevelpc.ma/165-processeur';

async function fetchPage(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  // Check all pagination-related links
  const paginationLinks: string[] = [];
  $('a[href*="page"]').each((_i, el) => {
    const href = $(el).attr('href') ?? '';
    if (href.includes('page')) paginationLinks.push(href);
  });

  // Check for any nav/pagination elements
  const navText = $('nav.pagination, .pagination, [class*="pagination"]').text().trim().slice(0, 200);

  // Count JSON-LD products
  let jsonLdCount = 0;
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const data = JSON.parse($(el).html() ?? '');
      if (data['@type'] === 'ItemList') jsonLdCount = data.itemListElement?.length ?? 0;
    } catch {}
  });

  // Check total products count text
  const totalText = $('.total-products, [class*="total"], .showing-results').text().trim().slice(0, 100);

  console.log(`\nURL: ${url}`);
  console.log(`Status: ${res.status} | Size: ${(await res.text().catch(() => '')).length} bytes`);
  console.log(`JSON-LD products: ${jsonLdCount}`);
  console.log(`Total text: "${totalText}"`);
  console.log(`Pagination nav: "${navText}"`);
  console.log(`Pagination links (first 10):`);
  paginationLinks.slice(0, 10).forEach(l => console.log(`  ${l}`));
}

// Test page 1
await fetchPage(BASE);

// Test page 2 with different URL patterns
await fetchPage(`${BASE}?page=2`);
await fetchPage(`${BASE}/page/2`);
await fetchPage(`https://nextlevelpc.ma/165-processeur?p=2`);

process.exit(0);
