import { sql } from 'bun';

console.log('Inspecting prices URLs for motherboards with wifi...\n');

const boards = await sql`
  SELECT id, name, brand, slug
  FROM components
  WHERE category = 'motherboard' AND is_active = true
`;

let hasWifiUrls = 0;
const wifiBoardsList: any[] = [];

for (const board of boards) {
  // Query all prices for this component to see if any URL contains wifi
  const prices = await sql`
    SELECT product_url
    FROM prices
    WHERE component_id = ${board.id}
  `;

  let isWifi = false;
  let matchingUrl = '';
  for (const p of prices) {
    if (p.product_url.toLowerCase().includes('wifi') || p.product_url.toLowerCase().includes('wi-fi')) {
      isWifi = true;
      matchingUrl = p.product_url;
      break;
    }
  }

  if (isWifi) {
    hasWifiUrls++;
    wifiBoardsList.push({ id: board.id, brand: board.brand, name: board.name, url: matchingUrl });
  }
}

console.log(`Total motherboards: ${boards.length}`);
console.log(`Motherboards with WiFi URLs: ${hasWifiUrls}`);
console.log('\nSample WiFi Motherboards:');
console.log(JSON.stringify(wifiBoardsList.slice(0, 30), null, 2));

process.exit(0);
