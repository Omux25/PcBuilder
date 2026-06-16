import { getSql } from './src/core/db/index.js';

async function main() {
    const sql = getSql();
    try {
        const rows = await sql`SELECT id, name FROM retailers;`;
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
main();
