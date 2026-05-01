-- Migration 011: Create unmatched_listings table
-- Holds scraped products that have no entry in scraper_mappings.
-- Admins review this queue and either link listings to a component
-- (creating a scraper_mappings entry) or dismiss them.

CREATE TABLE IF NOT EXISTS unmatched_listings (
    id                   SERIAL PRIMARY KEY,
    retailer_id          INTEGER        NOT NULL
                             REFERENCES retailers (id) ON DELETE CASCADE,
    product_url          TEXT           NOT NULL,
    scraped_name         VARCHAR(500)   NOT NULL,
    scraped_price        NUMERIC(10, 2),
    scraped_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    status               VARCHAR(20)    NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'linked', 'dismissed')),
    linked_component_id  INTEGER
                             REFERENCES components (id) ON DELETE SET NULL,

    -- Same URL from the same retailer should only appear once in the queue
    UNIQUE (retailer_id, product_url)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unmatched_listings_status
    ON unmatched_listings (status);

CREATE INDEX IF NOT EXISTS idx_unmatched_listings_retailer
    ON unmatched_listings (retailer_id);

CREATE INDEX IF NOT EXISTS idx_unmatched_listings_scraped_at
    ON unmatched_listings (scraped_at DESC);
