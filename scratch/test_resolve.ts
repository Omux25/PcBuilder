import { getSql } from '../apps/backend/src/core/db/index.js';
import { loadAdminRules, matchesRule } from '../apps/backend/src/modules/scraping/services/keywordRulesService.js';
import { inferCategory } from '../shared/hardware/categories.js';

const sql = getSql();

async function run() {
  const adminRules = await loadAdminRules();
  const testNames = [
    "Aerocool AERO BRONZE 650M FULL MODULAIRE",
    "Cooler Master V750 SFX 80PLUS GOLD",
    "Cooler Master V650 SFX 80PLUS GOLD",
    "Aerocool AERO BRONZE 750M FULL MODULAIRE",
    "Shadow ARGB (Glass) + PSU 80+ 650W",
    "HYBROK SHADOW ARGB (GLASS) + PSU 650W 80+ BRONZE"
  ];

  for (const name of testNames) {
    let matchedRule = null;
    for (const rule of adminRules) {
      if (matchesRule(rule, name)) {
        matchedRule = rule;
        break;
      }
    }
    const inf = inferCategory(name);
    console.log(`Name: "${name}"`);
    console.log(`  Matched Rule: ${matchedRule ? `${matchedRule.keyword} -> ${matchedRule.category}` : 'None'}`);
    console.log(`  InferCategory: ${inf}`);
  }
}

run().then(() => process.exit(0));
