-- Migration 023: Smart Catalog Expansion Engine
--
-- 1. Extends components.category CHECK to include 'fan' and 'thermal_paste'
-- 2. Adds fan-specific columns (size_mm, airflow_cfm, noise_db, rgb, pack_size)
-- 3. Adds thermal paste-specific columns (weight_grams, thermal_conductivity, paste_type)
-- 4. Creates unmatched_suggestions cache table
--
-- All new columns are nullable — existing rows are completely unaffected.
-- No existing migrations are modified.

-- ── 1. Extend category CHECK constraint ──────────────────────────────────────

ALTER TABLE components DROP CONSTRAINT IF EXISTS components_category_check;

ALTER TABLE components
    ADD CONSTRAINT components_category_check
        CHECK (category IN (
            'cpu', 'motherboard', 'gpu', 'ram',
            'storage', 'psu', 'case', 'cooling',
            'fan', 'thermal_paste'
        ));

-- ── 2. Fan-specific columns ───────────────────────────────────────────────────

ALTER TABLE components
    ADD COLUMN IF NOT EXISTS size_mm      SMALLINT,
    ADD COLUMN IF NOT EXISTS airflow_cfm  NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS noise_db     NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS rgb          BOOLEAN,
    ADD COLUMN IF NOT EXISTS pack_size    SMALLINT;

COMMENT ON COLUMN components.size_mm     IS 'Fan: diameter in mm (80, 92, 120, 140, 200)';
COMMENT ON COLUMN components.airflow_cfm IS 'Fan: airflow in CFM (optional)';
COMMENT ON COLUMN components.noise_db    IS 'Fan: noise level in dB(A) (optional)';
COMMENT ON COLUMN components.rgb         IS 'Fan: has RGB/ARGB lighting';
COMMENT ON COLUMN components.pack_size   IS 'Fan: number of fans in the pack (1, 3, etc.)';

-- ── 3. Thermal paste-specific columns ────────────────────────────────────────

ALTER TABLE components
    ADD COLUMN IF NOT EXISTS weight_grams         NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS thermal_conductivity NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS paste_type           VARCHAR(20)
        CHECK (paste_type IN ('paste', 'liquid_metal', 'pad'));

COMMENT ON COLUMN components.weight_grams         IS 'Thermal paste: weight in grams';
COMMENT ON COLUMN components.thermal_conductivity IS 'Thermal paste: conductivity in W/m·K (optional)';
COMMENT ON COLUMN components.paste_type           IS 'Thermal paste: type — paste, liquid_metal, or pad';

-- ── 4. Suggestion cache table ─────────────────────────────────────────────────
-- Stores pre-computed suggestion results for each pending unmatched listing.
-- Populated by the suggestion preprocessor after every scrape session.
-- Deleted when a listing is linked or dismissed.

CREATE TABLE IF NOT EXISTS unmatched_suggestions (
    id                    SERIAL PRIMARY KEY,
    unmatched_listing_id  INTEGER        NOT NULL UNIQUE
                              REFERENCES unmatched_listings (id) ON DELETE CASCADE,
    category              VARCHAR(50),
    confidence            VARCHAR(10)    NOT NULL
                              CHECK (confidence IN ('high', 'medium', 'low')),
    canonical_name        VARCHAR(500)   NOT NULL,
    brand                 VARCHAR(100),
    existing_component_id INTEGER
                              REFERENCES components (id) ON DELETE SET NULL,
    specs_hint            JSONB,
    computed_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE unmatched_suggestions IS
    'Pre-computed suggestion results for pending unmatched listings. '
    'Populated by the suggestion preprocessor after every scrape session. '
    'Deleted when a listing is linked or dismissed.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unmatched_suggestions_listing
    ON unmatched_suggestions (unmatched_listing_id);

CREATE INDEX IF NOT EXISTS idx_unmatched_suggestions_confidence
    ON unmatched_suggestions (confidence);

CREATE INDEX IF NOT EXISTS idx_unmatched_suggestions_canonical
    ON unmatched_suggestions (canonical_name);
