import { getSql } from '../src/db/index';
import fs from 'fs';

async function exportCatalog() {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, category, brand 
    FROM components 
    WHERE is_active = true 
    ORDER BY category, name
  ` as any[];

  let content = "# Full Component Catalog Export\n\n";
  content += `Total Active Components: ${rows.length}\n\n`;

  let currentCategory = "";
  for (const row of rows) {
    if (row.category !== currentCategory) {
      currentCategory = row.category;
      content += `\n## Category: ${currentCategory}\n\n`;
      content += "| ID | Name | Brand |\n";
      content += "|----|------|-------|\n";
    }
    content += `| ${row.id} | ${row.name} | ${row.brand || 'N/A'} |\n`;
  }

  fs.writeFileSync('catalog_full_dump.md', content);
  console.log(`Exported ${rows.length} components to catalog_full_dump.md`);
}

exportCatalog().catch(console.error).finally(() => process.exit());
