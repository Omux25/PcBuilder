-- Sample missing GPUs from UltraPC
SELECT DISTINCT scraped_name, scraped_price
FROM unmatched_listings
WHERE retailer_id = 10 AND status = 'pending'
  AND (scraped_name ILIKE '%rtx%' OR scraped_name ILIKE '%radeon%' OR scraped_name ILIKE '%rx %')
ORDER BY scraped_price DESC NULLS LAST
LIMIT 30;
