
import { scoreDnaMatch } from '../core/utils/componentMatcher.js';

const pName = 'SG 750W 80 PLUS BRONZE ( 2 ANS GARANTIE )';
const cName = 'Cooler Master Mwe V2 750W';
const category = 'psu';

console.log(scoreDnaMatch(pName, cName, category));
