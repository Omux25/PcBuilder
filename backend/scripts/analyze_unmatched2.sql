-- Sample unmatched products by category keywords to understand what's missing

-- CPUs not in catalog
SELECT scraped_name, scraped_price
FROM unmatched_listings
WHERE retailer_id = 10 AND status = 'pending'
  AND (scraped_name ILIKE '%ryzen%' OR scraped_name ILIKE '%core i%' OR scraped_name ILIKE '%core ultra%')
ORDER BY scraped_price DESC NULLS LAST
LIMIT 20;
