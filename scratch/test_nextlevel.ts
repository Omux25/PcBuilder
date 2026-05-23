import { fetch } from 'undici';

const CATEGORY_PATH = '165-processeur';
const BASE_URL = 'https://nextlevelpc.ma';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'fr-MA,fr;q=0.8,en-US;q=0.5,en;q=0.3',
  'X-Requested-With': 'XMLHttpRequest',
  'Connection': 'keep-alive',
};

async function run() {
  const url = `${BASE_URL}/${CATEGORY_PATH}?ajax=1&action=updateProductList&resultsPerPage=1000`;
  try {
    const res = await fetch(url, { headers: { ...HEADERS, 'Referer': `${BASE_URL}/${CATEGORY_PATH}` } });
    const text = await res.text();
    
    console.log(`Contains 6531?`, text.includes('6531'));
    console.log(`Contains 3900x?`, text.toLowerCase().includes('3900x'));
    console.log(`Contains 3900X?`, text.includes('3900X'));
    
    // Find all occurrences of 3900x/3900X
    const regex = /3900x/gi;
    let match;
    const matches = [];
    while ((match = regex.exec(text)) !== null) {
      matches.push(text.substring(match.index - 50, match.index + 100));
    }
    console.log(`Found ${matches.length} matches of 3900x/3900X:`);
    matches.forEach((m, idx) => console.log(`${idx + 1}: ...${m.replace(/\n/g, ' ')}...`));
  } catch (err) {
    console.error(err);
  }
}

run();
