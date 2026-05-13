-- Migration 004: Create scraper_logs table

CREATE TABLE IF NOT EXISTS scraper_logs (
    id          SERIAL PRIMARY KEY,
    level       VARCHAR(10) NOT NULL
                    CHECK (level IN ('INFO', 'WARNING', 'ERROR')),
    site        VARCHAR(100),
    message     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scraper_logs_created_at
    ON scraper_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_scraper_logs_level
    ON scraper_logs (level);

CREATE INDEX IF NOT EXISTS idx_scraper_logs_site
    ON scraper_logs (site);
