-- Migration 014: Prices variant model
--
-- Changes the prices table from "one row per (component, retailer)" to
-- "one row per (component, retailer, product_url)" so that all AIB variants
-- of a GPU, all CPU packaging options (BOX/Tray/MPK), and all other
-- retailer-specific variants are stored and displayed separately.
--
-- Also adds:
--   variant_label   — human-readable variant name extracted from the scraped
--                     product title (e.g. "Sapphire Pulse", "Tray", "BOX 16GB")
--   variant_details — JSONB for structured variant metadata:
--                     GPU: { aib_partner, cooling_type, slot_width, factory_boost_mhz }
--                     CPU: { packaging, has_igpu, has_3d_vcache, unlocked_multiplier }
--                     RAM: { kit_config, memory_profile, cas_latency }
--                     Storage: { form_factor, pcie_gen, has_dram_cache, nand_type }
--                     PSU: { modularity, atx_version }

-- 1. Drop the old unique constraint
ALTER TABLE prices
    DROP CONSTRAINT IF EXISTS prices_component_id_retailer_id_key;

-- 2. Add new columns
ALTER TABLE prices
    ADD COLUMN IF NOT EXISTS variant_label   VARCHAR(255),
    ADD COLUMN IF NOT EXISTS variant_details JSONB;

-- 3. New unique constraint: one row per (component, retailer, product_url)
ALTER TABLE prices
    ADD CONSTRAINT prices_component_retailer_url_key
        UNIQUE (component_id, retailer_id, product_url);

-- 4. Index on variant_label for filtering
CREATE INDEX IF NOT EXISTS idx_prices_variant_label
    ON prices (variant_label)
    WHERE variant_label IS NOT NULL;
