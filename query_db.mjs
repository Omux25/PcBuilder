import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://pcbuilder:devpassword@localhost:5432/pcbuilder' });
pool.query('SELECT * FROM traffic_logs ORDER BY created_at DESC LIMIT 5')
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => pool.end());
