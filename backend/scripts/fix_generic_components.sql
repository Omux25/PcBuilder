-- fix_generic_components.sql
-- 1. Deactivate all generic placeholder components
-- 2. Delete bad PSU mappings (SSDs/coolers/cases wrongly mapped to PSU generics)
-- 3. Add real motherboard entries for chipsets that have real products
-- 4. Remap correct products to the new real entries

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Deactivate all generic components
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE components
SET is_active = false
WHERE brand ILIKE '%generic%' OR name ILIKE '%generic%';

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Delete bad PSU mappings
-- The PSU generic entries (500W/600W/700W) were matched to SSDs, coolers,
-- and cases because the DNA matcher found wattage numbers in product names.
-- Delete ALL mappings pointing to PSU generics — they are all wrong.
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM scraper_mappings
WHERE component_id IN (
  SELECT id FROM components
  WHERE category = 'psu' AND (brand ILIKE '%generic%' OR name ILIKE '%generic%')
);

-- Also delete prices and unmatched links for these bad mappings
DELETE FROM prices
WHERE component_id IN (
  SELECT id FROM components
  WHERE category = 'psu' AND (brand ILIKE '%generic%' OR name ILIKE '%generic%')
);

COMMIT;
