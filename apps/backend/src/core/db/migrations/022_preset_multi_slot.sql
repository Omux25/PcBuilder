-- Migration 022: Allow multi-slot RAM and storage in preset_build_components
--
-- The original CHECK constraint only allowed the 8 base categories.
-- We now allow indexed slot keys (ram_1..ram_4, storage_1..storage_4)
-- so presets can include multiple RAM sticks or storage drives.
--
-- The UNIQUE constraint is kept on (preset_build_id, category) so each
-- slot key can only appear once per preset.

ALTER TABLE preset_build_components
    DROP CONSTRAINT IF EXISTS preset_build_components_category_check;

ALTER TABLE preset_build_components
    ADD CONSTRAINT preset_build_components_category_check
        CHECK (category IN (
            'cpu', 'motherboard', 'gpu',
            'ram', 'ram_1', 'ram_2', 'ram_3', 'ram_4',
            'storage', 'storage_1', 'storage_2', 'storage_3', 'storage_4',
            'psu', 'case', 'cooling'
        ));
