-- Analyze unmatched listings by product name patterns
-- to understand what's missing from the catalog

-- Count by first word (brand/type)
SELECT
  SPLIT_PART(scraped_name, ' ', 1) AS first_word,
  COUNT(*) AS count
FROM unmatched_listings
WHERE retailer_id = 10 AND status = 'pending'
GROUP BY first_word
ORDER BY count DESC
LIMIT 30;
