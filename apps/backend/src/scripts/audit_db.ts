
import { getSql } from '../core/db/index.js';

async function audit() {
  const sql = getSql();

  console.log('--- DATABASE AUDIT START ---');

  // 1. Find RAM components that have prices with different capacities in their labels
  console.log('\n[AUDIT] Checking for RAM components with mismatched capacity variants...');
  const ramMismatches = await sql`
    WITH variant_capacities AS (
      SELECT 
        p.component_id,
        c.name as component_name,
        c.capacity_gb as official_capacity,
        p.variant_label,
        p.price,
        CASE 
          WHEN p.variant_label ~* '([0-9]+)\s*(GB|Go)' THEN (regexp_match(p.variant_label, '([0-9]+)\s*(GB|Go)', 'i'))[1]::int
          ELSE NULL
        END as detected_capacity
      FROM prices p
      JOIN components c ON c.id = p.component_id
      WHERE c.category = 'ram'
    )
    SELECT 
      component_id, 
      component_name, 
      official_capacity,
      array_agg(DISTINCT detected_capacity) as detected_capacities,
      array_agg(DISTINCT variant_label) as labels,
      count(*) as price_count
    FROM variant_capacities
    GROUP BY component_id, component_name, official_capacity
    HAVING count(DISTINCT detected_capacity) > 1 
       OR (count(DISTINCT detected_capacity) = 1 AND max(detected_capacity) != official_capacity AND official_capacity IS NOT NULL)
    LIMIT 10;
  `;
  console.log('RAM Mismatches (Sample):', JSON.stringify(ramMismatches, null, 2));

  // 2. Find components with extreme price variance (e.g. > 3x difference)
  console.log('\n[AUDIT] Checking for components with extreme price variance...');
  const priceVariance = await sql`
    SELECT 
      p.component_id,
      c.name,
      c.category,
      min(p.price) as min_price,
      max(p.price) as max_price,
      (max(p.price) / NULLIF(min(p.price), 0)) as variance_ratio,
      count(*) as listing_count
    FROM prices p
    JOIN components c ON c.id = p.component_id
    WHERE p.price > 0
    GROUP BY p.component_id, c.name, c.category
    HAVING (max(p.price) / NULLIF(min(p.price), 0)) > 2.5
    ORDER BY variance_ratio DESC
    LIMIT 10;
  `;
  console.log('Extreme Price Variance (Sample):', JSON.stringify(priceVariance, null, 2));

  // 3. Find "Kingston Fury RGB" specifically
  console.log('\n[AUDIT] Investigating Kingston Fury RGB specifically...');
  const kingstonAudit = await sql`
    SELECT 
      c.id, c.name, c.capacity_gb, c.frequency_mhz,
      p.variant_label, p.price, p.product_url
    FROM components c
    JOIN prices p ON p.component_id = c.id
    WHERE c.name ILIKE '%Kingston%Fury%RGB%'
    ORDER BY c.id, p.price;
  `;
  console.log('Kingston Fury RGB listings:', JSON.stringify(kingstonAudit, null, 2));

  // 4. Category Pollution
  console.log('\n[AUDIT] Checking for category pollution...');
  const pollution = await sql`
    SELECT id, name, category, brand
    FROM components
    WHERE (category = 'ram' AND (name ILIKE '%SSD%' OR name ILIKE '%NVMe%' OR name ILIKE '%HDD%'))
       OR (category = 'storage' AND (name ILIKE '%DDR4%' OR name ILIKE '%DDR5%' OR name ILIKE '%SODIMM%'))
    LIMIT 10;
  `;
  console.log('Category Pollution (Sample):', JSON.stringify(pollution, null, 2));

  console.log('\n--- DATABASE AUDIT END ---');
}

audit().catch(console.error);
