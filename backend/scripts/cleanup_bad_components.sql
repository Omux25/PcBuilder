-- Remove the auto-generated components from the expand_catalog_from_unmatched script
-- These were created in the last hour with incomplete specs
DELETE FROM components
WHERE created_at > NOW() - INTERVAL '1 hour'
  AND description IS NULL
  AND (
    -- GPU entries missing proper fields
    (category = 'gpu' AND specs->>'chipset' IS NULL)
    OR
    -- CPU entries missing cores/threads
    (category = 'cpu' AND specs->>'cores' IS NULL)
    OR
    -- RAM entries missing cas_latency
    (category = 'ram' AND specs->>'cas_latency' IS NULL)
    OR
    -- Storage entries missing read_speed
    (category = 'storage' AND specs->>'read_speed_mbps' IS NULL)
  );

SELECT COUNT(*) AS remaining FROM components WHERE is_active = true;
