-- How many components have at least one price?
SELECT 
  COUNT(DISTINCT p.component_id) AS components_with_prices,
  COUNT(DISTINCT c.id) AS total_active_components,
  ROUND(COUNT(DISTINCT p.component_id)::numeric / COUNT(DISTINCT c.id) * 100, 1) AS coverage_pct
FROM components c
LEFT JOIN prices p ON p.component_id = c.id
WHERE c.is_active = true;

-- Prices per category
SELECT 
  c.category,
  COUNT(DISTINCT c.id) AS total_components,
  COUNT(DISTINCT p.component_id) AS components_with_prices,
  COUNT(p.id) AS total_price_records
FROM components c
LEFT JOIN prices p ON p.component_id = c.id
WHERE c.is_active = true
GROUP BY c.category
ORDER BY c.category;

-- Prices per retailer
SELECT 
  r.name,
  COUNT(p.id) AS price_records
FROM retailers r
LEFT JOIN prices p ON p.retailer_id = r.id
WHERE r.id IN (10, 11, 13)
GROUP BY r.id, r.name
ORDER BY r.id;

-- Sample: components WITH prices
SELECT c.name, c.category, p.price, r.name AS retailer
FROM prices p
JOIN components c ON c.id = p.component_id
JOIN retailers r ON r.id = p.retailer_id
ORDER BY c.category, p.price
LIMIT 20;

-- Sample: components WITHOUT any prices (first 20)
SELECT c.name, c.category, c.slug
FROM components c
WHERE c.is_active = true
  AND NOT EXISTS (SELECT 1 FROM prices p WHERE p.component_id = c.id)
ORDER BY c.category, c.name
LIMIT 20;
