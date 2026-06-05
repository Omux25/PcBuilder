-- Migration 044: Add standby and all valid categories to manual_category check
--
-- Drops the old category check constraint on manual_category and recreates
-- it to include 'standby' and all valid component categories.

ALTER TABLE unmatched_listings DROP CONSTRAINT IF EXISTS unmatched_listings_manual_category_check;

ALTER TABLE unmatched_listings
    ADD CONSTRAINT unmatched_listings_manual_category_check
        CHECK (manual_category IN (
            'cpu', 'motherboard', 'gpu', 'ram',
            'storage', 'psu', 'case', 'cooling',
            'fan', 'thermal_paste', 'fan_controller',
            'case_accessory', 'accessory', 'monitor',
            'keyboard', 'mouse', 'headphones', 'speakers',
            'webcam', 'wired_network_adapter', 'wireless_network_adapter',
            'sound_card', 'external_storage', 'optical_drive', 'ups',
            'os', 'software', 'build', 'bundle', 'standby'
        ));
