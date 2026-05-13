import { sql } from 'bun';
const rows = await sql`SELECT COUNT(*)::int as cnt FROM components WHERE benchmark_score IS NOT NULL`;
console.log(`Components with benchmark scores: ${rows[0].cnt}`);

const samples = await sql`SELECT name, brand, category, benchmark_score FROM components WHERE benchmark_score IS NOT NULL LIMIT 10`;
console.log('\nSamples:');
console.log(samples);
