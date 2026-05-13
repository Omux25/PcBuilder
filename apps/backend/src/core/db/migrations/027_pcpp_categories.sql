-- Migration 027: Expand categories to match PCPartPicker standards
--
-- 1. Updates the components_category_check constraint to include new categories
-- 2. Adds generic support for peripherals and accessories
--

ALTER TABLE components DROP CONSTRAINT IF EXISTS components_category_check;

ALTER TABLE components
    ADD CONSTRAINT components_category_check
        CHECK (category IN (
            -- Core Components
            'cpu', 'cooling', 'motherboard', 'ram', 'storage', 'gpu', 'case', 'psu',
            
            -- Operating System
            'os',
            
            -- Monitor
            'monitor',
            
            -- Expansion Cards / Networking
            'sound_card', 'wired_network_adapter', 'wireless_network_adapter',
            
            -- Peripherals
            'headphones', 'keyboard', 'mouse', 'speakers', 'webcam',
            
            -- Accessories / Other
            'case_accessory', 'fan', 'fan_controller', 'thermal_paste', 'external_storage', 'optical_drive', 'ups', 'accessory'
        ));

COMMENT ON COLUMN components.category IS 'Component category (PCPartPicker compatible list)';
