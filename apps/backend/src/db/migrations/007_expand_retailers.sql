-- Migration 007: Expand retailers table with scraping configuration fields
-- Adds: logo_url, country, is_active, scraping_interval_hours,
--       last_scrape_at, last_scrape_status, notes
-- Renames existing 'active' column to 'is_active' for consistency.

-- Rename existing 'active' column to 'is_active'
ALTER TABLE retailers
    RENAME COLUMN active TO is_active;

-- Add new scraping config columns
ALTER TABLE retailers
    ADD COLUMN IF NOT EXISTS logo_url                TEXT,
    ADD COLUMN IF NOT EXISTS country                 CHAR(2)      NOT NULL DEFAULT 'MA',
    ADD COLUMN IF NOT EXISTS scraping_interval_hours SMALLINT     NOT NULL DEFAULT 24,
    ADD COLUMN IF NOT EXISTS last_scrape_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_scrape_status      VARCHAR(20)
                                 CHECK (last_scrape_status IN ('SUCCESS', 'PARTIAL', 'FAILED')),
    ADD COLUMN IF NOT EXISTS notes                   TEXT;

-- Index for active retailers (scheduler queries this frequently)
CREATE INDEX IF NOT EXISTS idx_retailers_is_active
    ON retailers (is_active);
