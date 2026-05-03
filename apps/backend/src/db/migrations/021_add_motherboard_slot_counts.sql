-- Migration 021: Add slot count columns to motherboard components
--
-- These columns drive the multi-slot RAM and storage feature:
--   ram_slots   — how many DIMM slots the board has (e.g. 2 or 4)
--   m2_slots    — how many M.2 NVMe/SATA slots the board has
--   sata_ports  — how many SATA ports the board has
--
-- All nullable — existing motherboards keep working; the slot-count
-- compatibility rules only fire when the data is present.
-- Default display in the configurator falls back to 2 RAM slots and
-- 2 storage slots when no motherboard is selected or the board has no data.

ALTER TABLE components
    ADD COLUMN IF NOT EXISTS ram_slots   SMALLINT,
    ADD COLUMN IF NOT EXISTS m2_slots    SMALLINT,
    ADD COLUMN IF NOT EXISTS sata_ports  SMALLINT;

COMMENT ON COLUMN components.ram_slots IS
    'Motherboard: number of DIMM slots (e.g. 2 or 4). Used by ram_slots_exceeded rule.';

COMMENT ON COLUMN components.m2_slots IS
    'Motherboard: number of M.2 slots. Used by storage_slots_exceeded rule.';

COMMENT ON COLUMN components.sata_ports IS
    'Motherboard: number of SATA ports. Used by storage_slots_exceeded rule.';
