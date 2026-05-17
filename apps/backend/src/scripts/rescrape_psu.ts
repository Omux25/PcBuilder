
import { getSql } from '../core/db/index.js';
import { buildFromUnmatched } from '../modules/scraping/engine/catalogBuilder.js';

async function mockUnmatchedAndBuild() {
  const sql = getSql();
  console.log('--- INSERTING UNMATCHED LISTINGS ---');
  
  const setupGame = (await sql`SELECT id FROM retailers LIMIT 1`) as { id: number }[];
  const retailerId = setupGame[0].id;

  const products = [
    {
      url: 'https://setupgame.ma/produit/alimentation-sg-750w-80-plus-bronze-maroc/',
      name: 'SG 750W 80 PLUS BRONZE ( 2 ANS GARANTIE )',
      price: 650,
      imageUrl: 'https://setupgame.ma/wp-content/uploads/2023/12/SG-750W.jpg',
    },
    {
      url: 'https://setupgame.ma/produit/alimentation-sg-550w-80-plus-bronze-maroc/',
      name: 'SG 550W 80 PLUS BRONZE ( 2 ANS GARANTIE )',
      price: 450,
      imageUrl: 'https://setupgame.ma/wp-content/uploads/2023/12/SG-550W.jpg',
    }
  ];

  for (const p of products) {
    await sql`
      INSERT INTO unmatched_listings (retailer_id, product_url, scraped_name, scraped_price, image_url, status)
      VALUES (${retailerId}, ${p.url}, ${p.name}, ${p.price}, ${p.imageUrl}, 'pending')
      ON CONFLICT (retailer_id, product_url) DO UPDATE 
      SET status = 'pending', linked_component_id = NULL
    `;
  }

  console.log('--- RUNNING CATALOG BUILDER ---');
  await buildFromUnmatched((done, total) => {
    if (done === total) console.log(`Finished catalog builder: ${done}/${total}`);
  });

  const psus = await sql`SELECT id, name, brand, category, wattage FROM components WHERE brand = 'Setup Game' AND category = 'psu'`;
  console.log('\n--- SETUP GAME PSUS ---');
  console.log(psus);
}

mockUnmatchedAndBuild().catch(console.error);
