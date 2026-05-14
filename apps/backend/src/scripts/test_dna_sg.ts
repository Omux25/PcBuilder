
import { scoreDnaMatch } from '../core/utils/componentMatcher.js';

const pName1 = 'SG 750W 80 PLUS BRONZE ( 2 ANS GARANTIE )';
const cName1 = 'Setup Game 550W 80 Plus Bronze ( 2 Ans Garantie )';

console.log(scoreDnaMatch(pName1, cName1, 'psu'));
