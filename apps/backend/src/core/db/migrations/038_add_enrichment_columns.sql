-- Migration 038: Add enrichment tracking columns
ALTER TABLE components
    ADD COLUMN IF NOT EXISTS manufacturer_url    TEXT,
    ADD COLUMN IF NOT EXISTS specs_last_mined_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN components.manufacturer_url    IS 'Direct link to official product page for scraping specs';
COMMENT ON COLUMN components.specs_last_mined_at IS 'When the automated spec miner last attempted to find data for this component';
