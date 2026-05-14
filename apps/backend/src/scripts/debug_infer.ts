
import { inferCategory } from '../../../../shared/hardware/categories.js';

const names = [
  'MSI MAG A650Bn',
  'Antec Cx300 ARGB',
  'Goodram Cx400 Gen.2',
  'Antec CX300 ARGB Blanc',
  'XTRMLAB Frost F902'
];

console.log('--- DEBUG INFER CATEGORY ---');
names.forEach(name => {
  console.log(`"${name}" -> ${inferCategory(name)}`);
});
