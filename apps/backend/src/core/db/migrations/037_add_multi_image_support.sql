-- Migration 037: Add multi-image support to components
-- Adds image_urls (TEXT ARRAY) to store secondary product shots.
-- We keep image_url as the primary/legacy field for backward compatibility.

ALTER TABLE components
    ADD COLUMN IF NOT EXISTS image_urls TEXT[];

-- Also add it to unmatched_listings for the admin preview
ALTER TABLE unmatched_listings
    ADD COLUMN IF NOT EXISTS image_urls TEXT[];
