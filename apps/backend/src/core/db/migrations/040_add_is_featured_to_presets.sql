-- Migration 040: Add is_featured column to preset_builds
ALTER TABLE preset_builds ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_preset_builds_is_featured ON preset_builds (is_featured) WHERE is_featured = TRUE;
