-- Add MPN and EAN columns to components table
ALTER TABLE components ADD COLUMN IF NOT EXISTS mpn VARCHAR(100);
ALTER TABLE components ADD COLUMN IF NOT EXISTS ean VARCHAR(20);

-- Add indexes for deduplication and faster lookup
CREATE INDEX IF NOT EXISTS idx_components_mpn ON components (mpn) WHERE mpn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_components_ean ON components (ean) WHERE ean IS NOT NULL;
