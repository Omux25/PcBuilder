import { getSql } from '../../src/core/db/index.js';
const sql = getSql();

console.log('Cleaning up interface_type values...');
const res1 = await sql`
  UPDATE components 
  SET interface_type = 'NVMe' 
  WHERE category = 'storage' AND interface_type ILIKE '%PCIe%'
`;
console.log('Mapped PCIe interfaces to NVMe.');

const res2 = await sql`
  UPDATE components 
  SET interface_type = 'SATA' 
  WHERE category = 'storage' AND (interface_type = 'M.2 SATA' OR interface_type = 'SATA 6.0 Gb/s')
`;
console.log('Mapped M.2 SATA/SATA 6.0 Gb/s to SATA.');

const check = await sql`SELECT DISTINCT interface_type, COUNT(*) FROM components WHERE category = 'storage' GROUP BY interface_type`;
console.table(check);
