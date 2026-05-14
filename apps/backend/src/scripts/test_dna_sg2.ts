
import { extractDna, scoreDnaMatch } from '../core/utils/componentMatcher.js';

const pName = 'SG 750W 80 PLUS BRONZE ( 2 ANS GARANTIE )';
const cName = 'Nox Urano Vx 750W';

console.log('Product DNA:', extractDna(pName, 'psu'));
console.log('Catalog DNA:', extractDna(cName, 'psu'));
console.log('Match Score:', scoreDnaMatch(pName, cName, 'psu'));
