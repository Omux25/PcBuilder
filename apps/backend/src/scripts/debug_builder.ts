
import { inferCategory, extractBrand, cleanName } from '@shared/component-utils';

const scrapedName = 'SG 750W 80 PLUS BRONZE ( 2 ANS GARANTIE )';
const category = inferCategory(scrapedName);
const brand = 'SG'; // from extractBrand normally
const cleanedName = cleanName(scrapedName, brand, category);

console.log({ scrapedName, category, brand, cleanedName });
