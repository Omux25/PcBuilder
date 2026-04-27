SELECT c.name, c.category, p.price, p.in_stock
FROM prices p
JOIN components c ON c.id = p.component_id
WHERE p.retailer_id = 10
ORDER BY c.category, p.price
LIMIT 20;
