import { inferCategory } from '../shared/hardware/categories.js';

const variations = [
  "V650 Sfx 80Plus Gold",
  "Cooler Master V650 Sfx 80Plus Gold",
  "Setup Game Cooler Master V650 Sfx 80Plus Gold",
  "Aerocool Aero Bronze 650M Full Modulaire",
  "Aero Bronze 650M Full Modulaire"
];

for (const v of variations) {
  console.log(`"${v}" -> ${inferCategory(v)}`);
}
