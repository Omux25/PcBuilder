import { suggestForListing } from '../apps/backend/src/modules/scraping/services/suggestionEngine.js';

const suggestions = [
  suggestForListing("Cooler Master V750 SFX 80PLUS GOLD", [], []),
  suggestForListing("Cooler Master V650 SFX 80PLUS GOLD", [], []),
  suggestForListing("Aerocool AERO BRONZE 650M FULL MODULAIRE", [], []),
];

console.log(JSON.stringify(suggestions, null, 2));
