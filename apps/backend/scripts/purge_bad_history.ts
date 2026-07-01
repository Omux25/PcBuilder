import { SQL } from 'bun';

const sql = new SQL(process.env.DATABASE_URL!);

async function purgeBadHistory() {
  console.log('Starting surgical purge of anomalous price history...');
  
  // Find components with anomalous price history spikes (e.g., PC prices on CPU/GPU components)
  // Delete price_history rows where the price is > 1.5x the MIN price of that component in history.
  
  const result = await sql`
    WITH MinPrices AS (
      SELECT component_id, MIN(price) as min_price
      FROM price_history
      GROUP BY component_id
    )
    DELETE FROM price_history ph
    USING MinPrices mp, components c
    WHERE ph.component_id = mp.component_id
      AND ph.component_id = c.id
      AND c.category IN ('cpu', 'gpu')
      AND ph.price > (mp.min_price * 1.5)
    RETURNING ph.id;
  `;
  
  console.log(`Deleted ${result.length} anomalous price history records for CPUs and GPUs.`);
  process.exit(0);
}

purgeBadHistory().catch(err => {
  console.error(err);
  process.exit(1);
});
