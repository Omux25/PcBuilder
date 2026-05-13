-- Migration 036: Schema enrichment — promote JSONB fields to typed columns,
-- add MPN, tags, and remaining spec columns.
--
-- Phase 1: Typed columns (replaces specs JSONB for filtering/display)
-- Phase 2: MPN — Manufacturer Part Number (skeleton key for master-reference matching)
-- Phase 3: Tags — parseable aesthetic/feature tags for Morocco market

ALTER TABLE components
    -- GPU / Motherboard: chipset (e.g. 'RTX 4090', 'B650M', 'Z790')
    ADD COLUMN IF NOT EXISTS chipset              VARCHAR(80),

    -- Storage: interface type (NVMe, SATA, HDD)
    ADD COLUMN IF NOT EXISTS interface_type       VARCHAR(20),

    -- Storage: sequential read/write speeds
    ADD COLUMN IF NOT EXISTS read_speed_mbps      INTEGER,
    ADD COLUMN IF NOT EXISTS write_speed_mbps     INTEGER,

    -- PSU: efficiency rating (80+ Bronze/Gold/Platinum/Titanium)
    ADD COLUMN IF NOT EXISTS efficiency_rating    VARCHAR(20),

    -- PSU: modularity (Full, Semi, Non)
    ADD COLUMN IF NOT EXISTS modular              VARCHAR(10),

    -- CPU: clock speeds
    ADD COLUMN IF NOT EXISTS base_clock_ghz       NUMERIC(4,2),
    ADD COLUMN IF NOT EXISTS boost_clock_ghz      NUMERIC(4,2),

    -- RAM: total kit capacity in GB (e.g. 16 for a 2×8GB kit)
    -- Note: capacity_gb already exists for storage — this is the same column, reused for RAM
    -- capacity_gb was added in migration 032 for storage; we reuse it for RAM total capacity

    -- MPN: Manufacturer Part Number (e.g. 'CMK16GX4M2B3200C16', 'KF560C36BBEK2-32')
    ADD COLUMN IF NOT EXISTS mpn                  VARCHAR(100),

    -- Tags: aesthetic/feature tags parseable from names
    -- e.g. {'rgb', 'white', 'low-profile', 'nvme', 'wifi', 'modular'}
    ADD COLUMN IF NOT EXISTS tags                 TEXT[];

-- Comments
COMMENT ON COLUMN components.chipset          IS 'GPU: chipset model (e.g. RTX 4090, RX 7900 XTX). Motherboard: chipset (e.g. B650M, Z790).';
COMMENT ON COLUMN components.interface_type   IS 'Storage: interface type (NVMe, SATA, HDD)';
COMMENT ON COLUMN components.read_speed_mbps  IS 'Storage: sequential read speed in MB/s';
COMMENT ON COLUMN components.write_speed_mbps IS 'Storage: sequential write speed in MB/s';
COMMENT ON COLUMN components.efficiency_rating IS 'PSU: 80+ efficiency rating (Bronze, Gold, Platinum, Titanium)';
COMMENT ON COLUMN components.modular          IS 'PSU: modularity (Full, Semi, Non)';
COMMENT ON COLUMN components.base_clock_ghz   IS 'CPU: base clock speed in GHz';
COMMENT ON COLUMN components.boost_clock_ghz  IS 'CPU: boost/turbo clock speed in GHz';
COMMENT ON COLUMN components.mpn              IS 'Manufacturer Part Number — links to master reference databases';
COMMENT ON COLUMN components.tags             IS 'Feature/aesthetic tags: rgb, white, black, low-profile, nvme, sata, wifi, modular, aio';

-- ── Backfill from specs JSONB ─────────────────────────────────────────────

-- GPU: chipset from specs
UPDATE components
SET chipset = specs->>'chipset'
WHERE category = 'gpu'
  AND chipset IS NULL
  AND specs->>'chipset' IS NOT NULL;

-- Motherboard: chipset from specs
UPDATE components
SET chipset = specs->>'chipset'
WHERE category = 'motherboard'
  AND chipset IS NULL
  AND specs->>'chipset' IS NOT NULL;

-- Storage: interface from specs
UPDATE components
SET interface_type = specs->>'interface'
WHERE category = 'storage'
  AND interface_type IS NULL
  AND specs->>'interface' IS NOT NULL;

-- Storage: read/write speeds from specs
UPDATE components
SET read_speed_mbps = (specs->>'read_speed_mbps')::INTEGER
WHERE category = 'storage'
  AND read_speed_mbps IS NULL
  AND specs->>'read_speed_mbps' IS NOT NULL;

UPDATE components
SET write_speed_mbps = (specs->>'write_speed_mbps')::INTEGER
WHERE category = 'storage'
  AND write_speed_mbps IS NULL
  AND specs->>'write_speed_mbps' IS NOT NULL;

-- PSU: efficiency from specs
UPDATE components
SET efficiency_rating = specs->>'efficiency_rating'
WHERE category = 'psu'
  AND efficiency_rating IS NULL
  AND specs->>'efficiency_rating' IS NOT NULL;

-- PSU: modular from specs
UPDATE components
SET modular = CASE
    WHEN specs->>'modular' IN ('true', 'Full', 'full') THEN 'Full'
    WHEN specs->>'modular' IN ('Semi', 'semi') THEN 'Semi'
    WHEN specs->>'modular' IN ('false', 'Non', 'non') THEN 'Non'
    ELSE specs->>'modular'
END
WHERE category = 'psu'
  AND modular IS NULL
  AND specs->>'modular' IS NOT NULL;

-- CPU: clocks from specs
UPDATE components
SET base_clock_ghz = (specs->>'base_clock_ghz')::NUMERIC
WHERE category = 'cpu'
  AND base_clock_ghz IS NULL
  AND specs->>'base_clock_ghz' IS NOT NULL;

UPDATE components
SET boost_clock_ghz = (specs->>'boost_clock_ghz')::NUMERIC
WHERE category = 'cpu'
  AND boost_clock_ghz IS NULL
  AND specs->>'boost_clock_ghz' IS NOT NULL;

-- ── Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_components_chipset
    ON components (chipset) WHERE chipset IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_components_interface_type
    ON components (interface_type) WHERE interface_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_components_efficiency_rating
    ON components (efficiency_rating) WHERE efficiency_rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_components_mpn
    ON components (mpn) WHERE mpn IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_components_tags
    ON components USING GIN (tags) WHERE tags IS NOT NULL;
