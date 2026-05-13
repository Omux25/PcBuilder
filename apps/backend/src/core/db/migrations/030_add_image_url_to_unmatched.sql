-- Migration 020: Add image_url to unmatched_listings
-- Stores product image URLs scraped from retailer websites.
-- When a listing is linked to a component, the image_url can be copied
-- to the components table if the component doesn't already have one.

ALTER TABLE unmatched_listings
    ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Index for quick lookups when backfilling component images
CREATE INDEX IF NOT EXISTS idx_unmatched_listings_linked_component
    ON unmatched_listings (linked_component_id)
    WHERE linked_component_id IS NOT NULL;
