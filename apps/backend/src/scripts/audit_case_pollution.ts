
import { getSql } from '../core/db/index.js';

async function auditCases() {
  const sql = getSql();
  console.log('--- AUDITING CASE CATEGORY FOR POLLUTION ---');

  const problematicCases = await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE category = 'case'
    AND (
      name ~* '(fan|ventilateur|cooler|refroidissement|watercooling|aio|power supply|alimentation|psu|watt|thermal paste|pâte thermique|pate thermique)'
      OR brand IN ('SG', 'XTRMLAB', 'XTMLAB')
    )
    ORDER BY brand, name;
  `;

  console.log(`Found ${problematicCases.length} potentially miscategorized components in 'case':`);
  problematicCases.forEach(c => {
    console.log(`- [${c.id}] Brand: ${c.brand} | Name: ${c.name}`);
  });
}

auditCases().catch(console.error);
