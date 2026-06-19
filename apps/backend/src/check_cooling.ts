import { SQL } from 'bun';

const sql = new SQL(process.env.DATABASE_URL!);

async function dumpCoolers() {
  const unmatched = await sql`
    SELECT scraped_name, scraped_price, product_url
    FROM unmatched_listings
    WHERE scraped_name ILIKE '%watercooling%' 
       OR scraped_name ILIKE '%aio%' 
       OR scraped_name ILIKE '%ventirad%' 
       OR scraped_name ILIKE '%cooler %'
       OR scraped_name ILIKE '%refroidissement%'
    LIMIT 20
  `;
  
  console.log('--- MANUAL REVIEW OF UNMATCHED COOLERS ---');
  for (const item of unmatched) {
    console.log(`Name: ${item.scraped_name}`);
    console.log(`Price: ${item.scraped_price} MAD`);
    console.log(`URL: ${item.product_url}\n`);
  }
  process.exit(0);
}

dumpCoolers();
