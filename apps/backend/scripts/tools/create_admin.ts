/**
 * One-time script to create an admin account.
 * Usage: bun scripts/tools/create_admin.ts <username> <password>
 */
import bcrypt from 'bcrypt';
import { getSql } from '../../src/core/db/index.js';

const [username, password] = process.argv.slice(2);

if (!username || !password) {
    console.error('Usage: bun scripts/tools/create_admin.ts <username> <password>');
    process.exit(1);
}

const sql = getSql();
const hash = await bcrypt.hash(password, 10);

await sql`
  INSERT INTO admins (username, password_hash)
  VALUES (${username}, ${hash})
`;

console.log(`✅ Admin "${username}" created successfully.`);
process.exit(0);
