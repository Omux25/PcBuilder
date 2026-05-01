-- Migration 019: Add missing compatibility columns to components table
--
-- These columns are required for Rules 5 and 6 of the compatibility engine:
--   Rule 5 (form_factor_mismatch): case.supported_motherboards, motherboard.form_factor
--   Rule 6 (cooler_too_tall):      case.max_cooler_height_mm, cooling.height_mm
--
-- Previously these values were only accessible via the specs JSONB fallback,
-- meaning components created through the admin API could never trigger these rules.
-- Adding flat columns makes them first-class fields validated by Zod schemas.

ALTER TABLE components
    ADD COLUMN IF NOT EXISTS supported_motherboards TEXT[],
    ADD COLUMN IF NOT EXISTS max_cooler_height_mm   SMALLINT,
    ADD COLUMN IF NOT EXISTS form_factor            VARCHAR(50),
    ADD COLUMN IF NOT EXISTS height_mm              SMALLINT;

COMMENT ON COLUMN components.supported_motherboards IS
    'Case: list of supported motherboard form factors (e.g. ARRAY[''ATX'',''mATX'',''Mini-ITX'']). Used by Rule 5 (form_factor_mismatch).';

COMMENT ON COLUMN components.max_cooler_height_mm IS
    'Case: maximum CPU cooler height in mm. Used by Rule 6 (cooler_too_tall).';

COMMENT ON COLUMN components.form_factor IS
    'Motherboard/Case: form factor string (e.g. ''ATX'', ''mATX'', ''Mini-ITX''). Used by Rule 5 (form_factor_mismatch).';

COMMENT ON COLUMN components.height_mm IS
    'Cooling: cooler height in mm. Used by Rule 6 (cooler_too_tall).';
