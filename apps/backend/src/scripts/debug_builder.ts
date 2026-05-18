
import { inferCategory } from '@shared/hardware/categories';
import { extractBrand } from '@shared/hardware/brands';
import { cleanName } from '@shared/hardware/cleaning';

const scrapedName = 'SG 750W 80 PLUS BRONZE ( 2 ANS GARANTIE )';
const category = inferCategory(scrapedName);
const brand = 'SG'; // from extractBrand normally
const cleanedName = cleanName(scrapedName, brand, category as any);

console.log({ scrapedName, category, brand, cleanedName });
