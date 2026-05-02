-- Migration 006: Expand components table for canonical catalog model
-- Adds catalog fields: slug, description, specs (JSONB), image_url, release_year, is_active
-- Existing columns (socket, wattage, tdp, etc.) are preserved — the compatibility
-- engine still reads them directly. The specs JSONB mirrors them for the API/frontend.

-- Add new catalog columns
ALTER TABLE components
    ADD COLUMN IF NOT EXISTS slug         VARCHAR(255),
    ADD COLUMN IF NOT EXISTS description  TEXT,
    ADD COLUMN IF NOT EXISTS specs        JSONB,
    ADD COLUMN IF NOT EXISTS image_url    TEXT,
    ADD COLUMN IF NOT EXISTS release_year SMALLINT,
    ADD COLUMN IF NOT EXISTS is_active    BOOLEAN NOT NULL DEFAULT TRUE;

-- Update category CHECK to include 'cooling'
ALTER TABLE components
    DROP CONSTRAINT IF EXISTS components_category_check;

ALTER TABLE components
    ADD CONSTRAINT components_category_check
        CHECK (category IN (
            'cpu', 'motherboard', 'gpu', 'ram',
            'storage', 'psu', 'case', 'cooling'
        ));

-- Backfill slugs for existing rows using name (brand may be NULL on old rows)
-- Format: lowercase, spaces → hyphens, strip non-alphanumeric except hyphens
UPDATE components
SET slug = LOWER(REGEXP_REPLACE(
    REGEXP_REPLACE(
        COALESCE(brand, '') || CASE WHEN brand IS NOT NULL THEN '-' ELSE '' END || name,
        '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
))
WHERE slug IS NULL;

-- Ensure uniqueness by appending row id to any duplicate slugs
UPDATE components c1
SET slug = c1.slug || '-' || c1.id
WHERE EXISTS (
    SELECT 1 FROM components c2
    WHERE c2.slug = c1.slug AND c2.id < c1.id
);

-- Now enforce NOT NULL and UNIQUE on slug
ALTER TABLE components
    ALTER COLUMN slug SET NOT NULL;

ALTER TABLE components
    ADD CONSTRAINT components_slug_unique UNIQUE (slug);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_components_slug
    ON components (slug);

CREATE INDEX IF NOT EXISTS idx_components_brand
    ON components (brand)
    WHERE brand IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_components_is_active
    ON components (is_active);
