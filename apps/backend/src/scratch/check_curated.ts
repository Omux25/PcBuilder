import { join } from 'path';

const curatedPath = join(import.meta.dirname, '../../seed/curated_catalog.json');
const curated = require(curatedPath);

const mbs = curated.components.filter((c: any) => c.category === 'motherboard');
console.log('Keys of first motherboard:', Object.keys(mbs[0]));
console.log('First motherboard details:', JSON.stringify(mbs[0], null, 2));

process.exit(0);
