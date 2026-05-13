import { sql } from 'bun';

async function verifyPsu() {
    const rows = await sql`
        SELECT id, name, brand 
        FROM components 
        WHERE category = 'psu' 
          AND (name ~* 'cooler|refroidisseur|liquid|water|boitier|chassis|tour|tower')
    `;
    console.table(rows);
}
await verifyPsu();
process.exit(0);
