
import { getSql } from '../core/db/index.js';

async function investigate() {
  const sql = getSql();
  console.log('--- INVESTIGATING NOX HUMMER ---');

  const components = await sql`
    SELECT id, name, category, brand, image_url, slug
    FROM components
    WHERE name ILIKE '%Nox%Hummer%' OR name ILIKE '%TGM%'
  `;
  console.log('Components matching "Nox Hummer" or "TGM":', JSON.stringify(components, null, 2));

  const prices = await sql`
    SELECT p.id, p.component_id, c.name as component_name, p.price, p.product_url, p.variant_label
    FROM prices p
    JOIN components c ON c.id = p.component_id
    WHERE p.product_url ILIKE '%nox-hummer-tgm-argb%'
  `;
  console.log('Prices for "TGM ARGB":', JSON.stringify(prices, null, 2));

  console.log('--- END INVESTIGATION ---');
}

investigate().catch(console.error);
