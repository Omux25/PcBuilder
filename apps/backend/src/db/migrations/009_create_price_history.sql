-- Migration 009: Create price_history table
-- Records every price change for each (component, retailer) pair.
-- A new row is inserted only when the price differs from the most recent entry.
-- The prices table continues to hold the current price; this table holds the timeline.

CREATE TABLE IF NOT EXISTS price_history (
    id              SERIAL PRIMARY KEY,
    component_id    INTEGER        NOT NULL
                        REFERENCES components (id) ON DELETE CASCADE,
    retailer_id     INTEGER        NOT NULL
                        REFERENCES retailers (id) ON DELETE CASCADE,
    price           NUMERIC(10, 2) NOT NULL,
    in_stock        BOOLEAN        NOT NULL DEFAULT FALSE,
    recorded_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Primary query pattern: fetch history for a component ordered by time
CREATE INDEX IF NOT EXISTS idx_price_history_component_recorded
    ON price_history (component_id, recorded_at DESC);

-- Secondary: filter by retailer within a component's history
CREATE INDEX IF NOT EXISTS idx_price_history_component_retailer
    ON price_history (component_id, retailer_id, recorded_at DESC);
