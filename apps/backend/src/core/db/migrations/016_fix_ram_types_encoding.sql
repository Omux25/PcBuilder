-- Migration 015: Fix malformed supported_ram_types values
--
-- Root cause: the catalog builder stored supported_ram_types as JSON-encoded
-- strings inside the array, e.g. {"\"DDR4\""} instead of {"DDR4"}.
-- This caused the compatibility engine's .includes() check to always fail
-- for the 53 affected motherboards, incorrectly flagging all RAM as incompatible.
--
-- Fix: strip the extra surrounding quotes from each array element.
-- Before: {"\"DDR4\"","\"DDR5\""}
-- After:  {"DDR4","DDR5"}

UPDATE components
SET supported_ram_types = ARRAY(
    SELECT TRIM(BOTH '"' FROM elem)
    FROM UNNEST(supported_ram_types) AS elem
    WHERE elem LIKE '"%"'
)
WHERE category = 'motherboard'
  AND is_active = true
  AND supported_ram_types::text LIKE '%\"%';
