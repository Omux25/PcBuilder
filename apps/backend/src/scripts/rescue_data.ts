import { getSql } from "../core/db/index.js";

async function rescuePrime() {
  const sql = getSql();
  console.log("Creating ASUS Prime GeForce RTX 5080 OC 16GB master component...");

  // Check if it already exists
  const existing = (await sql`SELECT id FROM components WHERE name ILIKE 'Prime GeForce RTX 5080 OC 16GB'`) as any[];
  let componentId;
  
  if (existing.length > 0) {
    componentId = existing[0].id;
    console.log("Component already exists with ID:", componentId);
  } else {
    const result = (await sql`
      INSERT INTO components (name, brand, category, chipset, vram_gb, slug)
      VALUES ('Prime GeForce RTX 5080 OC 16GB', 'ASUS', 'gpu', 'GeForce RTX 5080', 16, 'asus-prime-geforce-rtx-5080-oc-16gb')
      RETURNING id;
    `) as any[];
    componentId = result[0].id;
    console.log("Created new component with ID:", componentId);
  }

  // Update mappings
  const mappings = (await sql`
    UPDATE scraper_mappings 
    SET component_id = ${componentId}
    WHERE product_identifier ILIKE '%5080%' AND product_identifier ILIKE '%prime%'
    RETURNING id;
  `) as any[];
  console.log(`Mapped ${mappings.length} orphaned scraper_mappings to component ${componentId}.`);

  // Sync prices
  const prices = (await sql`
    UPDATE prices
    SET component_id = ${componentId}
    WHERE product_url IN (
      SELECT product_url FROM scraper_mappings WHERE component_id = ${componentId}
    )
    RETURNING id;
  `) as any[];
  console.log(`Synced ${prices.length} prices for component ${componentId}.`);
}

rescuePrime().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });