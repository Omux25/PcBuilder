import { getSql } from './src/core/db/index.js';

const sql = getSql();
console.log('sql has array method:', typeof (sql as any).array === 'function');
process.exit(0);
