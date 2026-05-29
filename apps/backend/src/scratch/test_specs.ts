import { extractMotherboardSpecs } from '../../../../shared/hardware/specs/motherboard';

console.log('A520M-Hvs:', extractMotherboardSpecs('A520M-Hvs', 'ASRock'));
console.log('MSI PRO H610M-E:', extractMotherboardSpecs('MSI PRO H610M-E', 'MSI'));
console.log('Biostar B760Mx2-E:', extractMotherboardSpecs('Biostar B760Mx2-E', 'Biostar'));
process.exit(0);
