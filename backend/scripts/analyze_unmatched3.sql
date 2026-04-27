-- What categories of products are unmatched?
SELECT
  CASE
    WHEN scraped_name ILIKE '%ryzen%' OR scraped_name ILIKE '%core i%' OR scraped_name ILIKE '%core ultra%' THEN 'CPU'
    WHEN scraped_name ILIKE '%rtx%' OR scraped_name ILIKE '%radeon%' OR scraped_name ILIKE '%rx %' OR scraped_name ILIKE '%gtx%' THEN 'GPU'
    WHEN scraped_name ILIKE '%ddr4%' OR scraped_name ILIKE '%ddr5%' OR scraped_name ILIKE '%dimm%' THEN 'RAM'
    WHEN scraped_name ILIKE '%ssd%' OR scraped_name ILIKE '%nvme%' OR scraped_name ILIKE '%m.2%' THEN 'Storage SSD'
    WHEN scraped_name ILIKE '%hdd%' OR scraped_name ILIKE '%disque dur%' OR scraped_name ILIKE '%barracuda%' OR scraped_name ILIKE '%ironwolf%' THEN 'Storage HDD'
    WHEN scraped_name ILIKE '%b450%' OR scraped_name ILIKE '%b550%' OR scraped_name ILIKE '%b650%' OR scraped_name ILIKE '%x670%' OR scraped_name ILIKE '%z790%' OR scraped_name ILIKE '%b760%' OR scraped_name ILIKE '%z690%' THEN 'Motherboard'
    WHEN scraped_name ILIKE '%watt%' OR scraped_name ILIKE '% w %' OR scraped_name ILIKE '%alimentation%' OR scraped_name ILIKE '%psu%' OR scraped_name ILIKE '%focus%' OR scraped_name ILIKE '%rm%' THEN 'PSU'
    WHEN scraped_name ILIKE '%boitier%' OR scraped_name ILIKE '%case%' OR scraped_name ILIKE '%tower%' OR scraped_name ILIKE '%meshify%' OR scraped_name ILIKE '%h510%' OR scraped_name ILIKE '%h710%' OR scraped_name ILIKE '%4000d%' THEN 'Case'
    WHEN scraped_name ILIKE '%cooler%' OR scraped_name ILIKE '%refroidissement%' OR scraped_name ILIKE '%ventilateur%' OR scraped_name ILIKE '%aio%' OR scraped_name ILIKE '%kraken%' OR scraped_name ILIKE '%nh-%' THEN 'Cooling'
    ELSE 'Other (peripherals, monitors, etc.)'
  END AS category,
  COUNT(*) AS count
FROM unmatched_listings
WHERE retailer_id = 10 AND status = 'pending'
GROUP BY category
ORDER BY count DESC;
