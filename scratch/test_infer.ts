import { inferCategory } from '../shared/hardware/categories.js';

const testNames = [
  "Shadow ARGB (Glass) + PSU 80+ 650W",
  "V650 Sfx 80Plus Gold",
  "V750 Sfx 80Plus Gold",
  "Aero Bronze 650M Full Modulaire",
  "Aero Bronze 750M Full Modulaire"
];

for (const name of testNames) {
  console.log(`"${name}" -> ${inferCategory(name)}`);
}
