-- Migration 034: Add kit_count to components for RAM kit tracking
-- kit_count = number of physical sticks in the product (e.g. 2 for a 2×8GB kit)
-- Default 1 — single stick. Only meaningful for RAM category.

ALTER TABLE components
    ADD COLUMN IF NOT EXISTS kit_count SMALLINT NOT NULL DEFAULT 1;

COMMENT ON COLUMN components.kit_count IS 'RAM: number of physical sticks in the kit (1 = single stick, 2 = dual-channel kit, 4 = quad kit). Default 1.';

-- Backfill: parse kit notation from existing RAM names
-- Handles: "2x8GB", "2x16GB", "2X8GB", "2 x 16GB", "4x8GB", "2x8Go" (French)
UPDATE components
SET kit_count = (
    regexp_match(name, '(\d+)\s*[xX×]\s*\d+\s*[GgBbOo]{2}')
)[1]::SMALLINT
WHERE category = 'ram'
  AND name ~* '\d+\s*[xX×]\s*\d+\s*[Gg][BbOo]'
  AND (regexp_match(name, '(\d+)\s*[xX×]\s*\d+\s*[GgBbOo]{2}'))[1]::SMALLINT BETWEEN 2 AND 8;
