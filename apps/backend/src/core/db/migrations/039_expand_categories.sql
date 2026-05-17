-- Migration 039: Expand valid component categories
ALTER TABLE components DROP CONSTRAINT IF EXISTS components_category_check;

ALTER TABLE components
    ADD CONSTRAINT components_category_check
        CHECK (category IN (
            'cpu', 'motherboard', 'gpu', 'ram',
            'storage', 'psu', 'case', 'cooling',
            'fan', 'thermal_paste', 'fan_controller',
            'case_accessory', 'accessory', 'monitor',
            'keyboard', 'mouse', 'headphones', 'speakers',
            'webcam', 'wired_network_adapter', 'wireless_network_adapter',
            'sound_card', 'external_storage', 'optical_drive', 'ups',
            'os', 'software', 'build', 'bundle'
        ));
