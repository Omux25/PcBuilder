-- Migration 008: Create scraper_mappings table
-- Links a retailer's product URL to a canonical component.
-- The scraper looks up this table to decide where to UPSERT a scraped price.
-- If no mapping exists for a (retailer_id, product_url) pair, the scraper
-- writes to unmatched_listings instead.

CREATE TABLE IF NOT EXISTS scraper_mappings (
    id                   SERIAL PRIMARY KEY,
    component_id         INTEGER      NOT NULL
                             REFERENCES components (id) ON DELETE CASCADE,
    retailer_id          INTEGER      NOT NULL
                             REFERENCES retailers (id) ON DELETE CASCADE,
    product_url          TEXT         NOT NULL,
    product_identifier   VARCHAR(255),          -- optional retailer-internal SKU/ID
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- One URL per retailer maps to exactly one component
    UNIQUE (retailer_id, product_url)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scraper_mappings_component
    ON scraper_mappings (component_id);

CREATE INDEX IF NOT EXISTS idx_scraper_mappings_retailer
    ON scraper_mappings (retailer_id);

-- Composite index for the scraper's primary lookup
CREATE INDEX IF NOT EXISTS idx_scraper_mappings_retailer_url
    ON scraper_mappings (retailer_id, product_url);
