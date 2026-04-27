-- What GPU models does UltraPC sell that we don't have?
SELECT gpu_model, COUNT(*) AS variants_on_ultrapc
FROM (
  SELECT
    CASE
      WHEN scraped_name ILIKE '%RTX 5090%' THEN 'RTX 5090'
      WHEN scraped_name ILIKE '%RTX 5080%' THEN 'RTX 5080'
      WHEN scraped_name ILIKE '%RTX 5070 Ti%' THEN 'RTX 5070 Ti'
      WHEN scraped_name ILIKE '%RTX 5070%' THEN 'RTX 5070'
      WHEN scraped_name ILIKE '%RTX 4090%' THEN 'RTX 4090'
      WHEN scraped_name ILIKE '%RTX 4080 SUPER%' THEN 'RTX 4080 SUPER'
      WHEN scraped_name ILIKE '%RTX 4080%' THEN 'RTX 4080'
      WHEN scraped_name ILIKE '%RTX 4070 Ti SUPER%' THEN 'RTX 4070 Ti SUPER'
      WHEN scraped_name ILIKE '%RTX 4070 Ti%' THEN 'RTX 4070 Ti'
      WHEN scraped_name ILIKE '%RTX 4070 SUPER%' THEN 'RTX 4070 SUPER'
      WHEN scraped_name ILIKE '%RTX 3090%' THEN 'RTX 3090'
      WHEN scraped_name ILIKE '%RTX 3080%' THEN 'RTX 3080'
      WHEN scraped_name ILIKE '%RX 9070 XT%' THEN 'RX 9070 XT'
      WHEN scraped_name ILIKE '%RX 9070%' THEN 'RX 9070'
      WHEN scraped_name ILIKE '%RX 7900 XTX%' THEN 'RX 7900 XTX'
      WHEN scraped_name ILIKE '%RX 7900 XT%' THEN 'RX 7900 XT'
      WHEN scraped_name ILIKE '%RX 7900 GRE%' THEN 'RX 7900 GRE'
      WHEN scraped_name ILIKE '%RX 6900 XT%' THEN 'RX 6900 XT'
      ELSE NULL
    END AS gpu_model
  FROM unmatched_listings
  WHERE retailer_id = 10 AND status = 'pending'
    AND (scraped_name ILIKE '%RTX%' OR scraped_name ILIKE '%RX %')
) sub
WHERE gpu_model IS NOT NULL
GROUP BY gpu_model
ORDER BY variants_on_ultrapc DESC;
