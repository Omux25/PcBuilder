-- Migration 035: Add cas_latency typed column for RAM
-- Extracted from component names (e.g. "CL16", "CL36", "CL40")
-- Stored as SMALLINT for efficient filtering and display.

ALTER TABLE components
    ADD COLUMN IF NOT EXISTS cas_latency SMALLINT;

COMMENT ON COLUMN components.cas_latency IS 'RAM: CAS latency (e.g. 16 for CL16, 36 for CL36). NULL when unknown.';

-- Backfill: parse CL notation from existing RAM names
-- Matches: CL16, CL18, CL30, CL32, CL34, CL36, CL38, CL40, CL42, CL46
UPDATE components
SET cas_latency = (
    regexp_match(name, '[Cc][Ll](\d+)')
)[1]::SMALLINT
WHERE category = 'ram'
  AND name ~* '[Cc][Ll]\d+'
  AND cas_latency IS NULL;

CREATE INDEX IF NOT EXISTS idx_components_cas_latency
    ON components (cas_latency)
    WHERE cas_latency IS NOT NULL;
