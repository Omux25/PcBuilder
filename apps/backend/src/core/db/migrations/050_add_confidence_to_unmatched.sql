-- Migration 050: Add confidence to unmatched_listings
-- Adds a confidence column so we can avoid calculating it dynamically.

ALTER TABLE unmatched_listings
ADD COLUMN IF NOT EXISTS confidence VARCHAR(20) DEFAULT 'low'
CHECK (confidence IN ('high', 'medium', 'low', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_unmatched_listings_confidence
    ON unmatched_listings (confidence);
