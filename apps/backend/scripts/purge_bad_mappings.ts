import { SQL } from 'bun';
import { extractDna, scoreDnaMatch, tokenToRegex } from '../src/core/utils/componentMatcher.js';
import { logger } from '../src/modules/scraping/engine/utils/logger.js';

const sql = new SQL(process.env.DATABASE_URL!);

async function purgeBadMappings() {
  console.log('Starting purge of bad prices...');
  let purgedCount = 0;

  // Get all CPU and GPU prices
  const prices = await sql`
    SELECT p.id, p.product_url, c.name, c.brand, c.category, c.id as component_id
    FROM prices p
    JOIN components c ON p.component_id = c.id
    WHERE c.category IN ('cpu', 'gpu')
  `;

  for (const p of prices) {
    const fullName = p.brand ? `${p.brand} ${p.name}` : p.name;
    
    const parts = p.product_url.split('/').filter(Boolean);
    const slug = parts[parts.length - 1] || '';
    const productNameToTest = slug.replace(/-/g, ' ');

    const { score, dnaTokens } = scoreDnaMatch(productNameToTest, fullName, p.category, true);

    if (score < 1.0 || dnaTokens.length === 0) {
      console.log(`[PURGE] Score: ${score.toFixed(2)} | Component: ${fullName} | Scraped: ${productNameToTest}`);
      await sql`DELETE FROM prices WHERE id = ${p.id}`;
      purgedCount++;
    }
  }

  console.log(`\nPurge complete. Removed ${purgedCount} invalid prices.`);
  process.exit(0);
}

purgeBadMappings().catch(err => {
  console.error(err);
  process.exit(1);
});
