import { sql } from 'bun';
import { extractDna } from './src/core/utils/componentMatcher.ts';

const rows = await sql`SELECT name, brand, category FROM components WHERE category IN ('cpu', 'gpu') LIMIT 20`;
for (const row of rows) {
    const fullName = `${row.brand ?? ''} ${row.name}`.trim();
    const dna = extractDna(fullName, row.category);
    console.log(`[${row.category}] "${fullName}" -> [${dna.join(', ')}]`);
}
