-- Migration 026: Add missing indexes for frequently queried columns
--
-- unmatched_listings.status — queried on every suggestion preprocessing run
-- unmatched_suggestions.computed_at — queried to find stale suggestions
-- unmatched_suggestions.existing_component_id — queried on component delete/update
-- unmatched_listings.retailer_id — queried for FK lookups and filtering

CREATE INDEX IF NOT EXISTS idx_unmatched_listings_status
    ON unmatched_listings (status);

CREATE INDEX IF NOT EXISTS idx_unmatched_listings_retailer_id
    ON unmatched_listings (retailer_id);

CREATE INDEX IF NOT EXISTS idx_unmatched_suggestions_computed_at
    ON unmatched_suggestions (computed_at);

CREATE INDEX IF NOT EXISTS idx_unmatched_suggestions_existing_component_id
    ON unmatched_suggestions (existing_component_id);
