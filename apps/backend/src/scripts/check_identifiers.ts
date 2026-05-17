
import { getSql } from '../core/db/index.js';

async function checkIdentifiers() {
  const sql = getSql();
  const id = 229;
  const mappings = (await sql`SELECT product_identifier FROM scraper_mappings WHERE component_id = ${id}`) as { product_identifier: string }[];
  console.log(`Identifiers for ID ${id}:`, mappings.map(m => m.product_identifier));
}

checkIdentifiers().catch(console.error);
