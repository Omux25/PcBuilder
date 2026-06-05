import { join } from 'path';

const curatedPath = join(import.meta.dirname, '../../seed/curated_catalog.json');
const curated = require(curatedPath);

const mbs = curated.components.filter((c: any) => c.category === 'motherboard');
const wifiMbs = mbs.filter((mb: any) => mb.name.toLowerCase().includes('wifi') || mb.name.toLowerCase().includes('wi-fi'));

console.log('Total motherboards in curated catalog:', mbs.length);
console.log('Total WiFi motherboards in curated catalog:', wifiMbs.length);

for (const mb of wifiMbs.slice(0, 30)) {
  console.log(`- "${mb.name}" (Brand: ${mb.brand})`);
}

process.exit(0);
