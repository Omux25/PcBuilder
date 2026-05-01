-- Enable pg_trgm extension for fast partial string matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add a stable searchable text column to avoid calculating it on every query
ALTER TABLE components ADD COLUMN IF NOT EXISTS search_text TEXT;

-- Update existing rows
UPDATE components 
SET search_text = LOWER(
    REGEXP_REPLACE(
        COALESCE(brand, '') || ' ' || name,
        '[^a-zA-Z0-9]+',
        ' ',
        'g'
    )
);

-- Create a GIN trigram index for fast LIKE '%term%' searches
CREATE INDEX IF NOT EXISTS idx_components_search_text_trgm ON components USING gin (search_text gin_trgm_ops);

-- Create a trigger function to keep search_text in sync
CREATE OR REPLACE FUNCTION sync_component_search_text() RETURNS trigger AS $$
BEGIN
    NEW.search_text := LOWER(
        REGEXP_REPLACE(
            COALESCE(NEW.brand, '') || ' ' || NEW.name,
            '[^a-zA-Z0-9]+',
            ' ',
            'g'
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger
DROP TRIGGER IF EXISTS trg_sync_component_search_text ON components;
CREATE TRIGGER trg_sync_component_search_text
BEFORE INSERT OR UPDATE OF name, brand ON components
FOR EACH ROW EXECUTE FUNCTION sync_component_search_text();
