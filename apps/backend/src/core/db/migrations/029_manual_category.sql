-- Migration 029: Manual category for unmatched listings
-- Allows admins to manually assign a category in the UI, 
-- which the reprocess pipeline will then use for auto-creation.

ALTER TABLE unmatched_listings 
ADD COLUMN IF NOT EXISTS manual_category VARCHAR(50) 
CHECK (manual_category IN (
    'cpu', 'motherboard', 'gpu', 'ram',
    'storage', 'psu', 'case', 'cooling',
    'fan', 'thermal_paste', 'monitor', 'keyboard', 
    'mouse', 'headphones', 'speakers', 'webcam', 
    'os', 'wired_network_adapter', 'wireless_network_adapter', 
    'sound_card', 'case_accessory', 'fan_controller', 
    'external_storage', 'optical_drive', 'ups', 'accessory'
));

COMMENT ON COLUMN unmatched_listings.manual_category IS 
    'Manually assigned category from the Admin UI. Overrides inferred category during reprocessing.';
