import { cleanName } from '../../../../shared/hardware/cleaning.js';

const tests = [
  { raw: 'MSI MAG A500N-H 500W 500W', brand: 'MSI' },
  { raw: 'Nova 550W 550W', brand: 'Nova' },
  { raw: 'Setup Game 550W 550W 80Plus Bronze', brand: 'Setup Game' },
  { raw: 'Gigabyte P550Ss Ice 550W 550W Silver', brand: 'Gigabyte' },
  { raw: 'Connect Pc 650W 650W Bronze Full Modular', brand: 'Connect' },
  { raw: 'Antec G750 - Alimentation 750W 750W 80Plus Gold Full Modular', brand: 'Antec' },
  { raw: 'Cooler Master Mwe V2 230V A/Eu 650W 650W', brand: 'Cooler Master' }
];

tests.forEach(t => {
  console.log(`Raw: "${t.raw}"`);
  console.log(`Clean: "${cleanName(t.raw, t.brand, 'psu')}"`);
  console.log('---');
});
