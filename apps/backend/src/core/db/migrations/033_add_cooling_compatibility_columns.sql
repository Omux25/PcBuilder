-- Migration 033: Add compatibility columns for cooling and PSU
-- cooling.socket        — socket(s) the cooler is compatible with (e.g. 'AM5', 'LGA1700')
--                         stored as text[], same pattern as supported_ram_types on motherboard
-- cooling.max_tdp       — maximum CPU TDP the cooler can handle (W)
-- components.psu_form_factor — PSU form factor (ATX, SFX, SFX-L, TFX, Flex-ATX)
--                              used to check PSU fits in the case

ALTER TABLE components
    ADD COLUMN IF NOT EXISTS supported_sockets      TEXT[],
    ADD COLUMN IF NOT EXISTS max_tdp                SMALLINT,
    ADD COLUMN IF NOT EXISTS psu_form_factor        VARCHAR(20),
    ADD COLUMN IF NOT EXISTS supported_psu_form_factors TEXT[];

COMMENT ON COLUMN components.supported_sockets          IS 'Cooling: list of CPU sockets this cooler supports (e.g. {AM4,AM5,LGA1700})';
COMMENT ON COLUMN components.max_tdp                    IS 'Cooling: maximum CPU TDP rating in watts';
COMMENT ON COLUMN components.psu_form_factor            IS 'PSU: physical form factor (ATX, SFX, SFX-L, TFX, Flex-ATX)';
COMMENT ON COLUMN components.supported_psu_form_factors IS 'Case: PSU form factors this case accepts (e.g. {ATX} or {SFX,SFX-L})';

-- Index for cooler socket lookups
CREATE INDEX IF NOT EXISTS idx_components_supported_sockets
    ON components USING GIN (supported_sockets)
    WHERE supported_sockets IS NOT NULL;

-- Index for PSU form factor lookups
CREATE INDEX IF NOT EXISTS idx_components_supported_psu_form_factors
    ON components USING GIN (supported_psu_form_factors)
    WHERE supported_psu_form_factors IS NOT NULL;
