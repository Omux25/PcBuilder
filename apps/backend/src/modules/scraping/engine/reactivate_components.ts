import { SQL } from 'bun';

async function reactivateComponents() {
  const sql = new SQL(process.env.DATABASE_URL!);
  
  console.log('Reactivating components...');
  const res = await sql`
    UPDATE components 
    SET is_active = true 
    WHERE is_active = false
    RETURNING id
  `;
  
  console.log(`Successfully reactivated ${res.length} components!`);
  
  // Verify
  const activeCount = await sql`SELECT COUNT(*) as count FROM components WHERE is_active = true`;
  console.log(`Total active components in DB now: ${activeCount[0].count}`);
  
  process.exit(0);
}

reactivateComponents().catch(console.error);
