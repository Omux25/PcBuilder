-- Migration 003: Create prices table
-- One row per (component, retailer) pair — enforced by the UNIQUE constraint.
-- The scraper UPSERT targets this constraint to update existing rows.

CREATE TABLE IF NOT EXISTS prices (
    id              SERIAL PRIMARY KEY,
    component_id    INTEGER      NOT NULL
                        REFERENCES components (id) ON DELETE CASCADE,
    retailer_id     INTEGER      NOT NULL
                        REFERENCES retailers (id) ON DELETE CASCADE,
    price           NUMERIC(10, 2) NOT NULL,
    in_stock        BOOLEAN      NOT NULL DEFAULT FALSE,
    product_url     VARCHAR(500) NOT NULL,
    last_updated    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE (component_id, retailer_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prices_component_id
    ON prices (component_id);

CREATE INDEX IF NOT EXISTS idx_prices_last_updated
    ON prices (last_updated);
