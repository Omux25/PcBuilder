-- Migration 032: Add detailed specification columns for better filtering
-- Adds core_count, thread_count, capacity_gb, and vram_gb to components table.

ALTER TABLE components
    ADD COLUMN IF NOT EXISTS core_count   SMALLINT,
    ADD COLUMN IF NOT EXISTS thread_count SMALLINT,
    ADD COLUMN IF NOT EXISTS capacity_gb  INTEGER,
    ADD COLUMN IF NOT EXISTS vram_gb      SMALLINT;

COMMENT ON COLUMN components.core_count   IS 'CPU: Number of physical cores';
COMMENT ON COLUMN components.thread_count IS 'CPU: Number of logical threads';
COMMENT ON COLUMN components.capacity_gb  IS 'Storage: Capacity in GB (e.g. 1000 for 1TB)';
COMMENT ON COLUMN components.vram_gb      IS 'GPU: Video memory in GB';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_components_core_count ON components (core_count) WHERE core_count IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_components_capacity_gb ON components (capacity_gb) WHERE capacity_gb IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_components_vram_gb ON components (vram_gb) WHERE vram_gb IS NOT NULL;
