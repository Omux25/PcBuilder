import { getSql } from '../core/db/index.js';

async function run() {
  const sql = getSql();
  
  const presets = await sql`
    SELECT pb.id, pb.name, c.image_url
    FROM preset_builds pb
    LEFT JOIN preset_build_components pbc ON pb.id = pbc.preset_build_id AND pbc.category = 'case'
    LEFT JOIN components c ON pbc.component_id = c.id
  `;
  
  console.log('Presets & Case Images:');
  console.log(JSON.stringify(presets, null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
