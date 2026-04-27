-- Migration 010: Create preset_builds and preset_build_components tables
-- preset_builds: curated PC builds created by admins for specific use cases.
-- preset_build_components: links each preset to one component per category slot.

CREATE TABLE IF NOT EXISTS preset_builds (
    id                   SERIAL PRIMARY KEY,
    name                 VARCHAR(255)   NOT NULL,
    description          TEXT,
    use_case             VARCHAR(50)    NOT NULL
                             CHECK (use_case IN ('gaming', 'workstation', 'office', 'budget')),
    total_price_estimate NUMERIC(10, 2),
    is_active            BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preset_build_components (
    id               SERIAL PRIMARY KEY,
    preset_build_id  INTEGER     NOT NULL
                         REFERENCES preset_builds (id) ON DELETE CASCADE,
    component_id     INTEGER     NOT NULL
                         REFERENCES components (id) ON DELETE CASCADE,
    category         VARCHAR(50) NOT NULL
                         CHECK (category IN (
                             'cpu', 'motherboard', 'gpu', 'ram',
                             'storage', 'psu', 'case', 'cooling'
                         )),

    -- Each preset can have at most one component per category slot
    UNIQUE (preset_build_id, category)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_preset_builds_use_case
    ON preset_builds (use_case);

CREATE INDEX IF NOT EXISTS idx_preset_builds_is_active
    ON preset_builds (is_active);

CREATE INDEX IF NOT EXISTS idx_preset_build_components_preset
    ON preset_build_components (preset_build_id);

CREATE INDEX IF NOT EXISTS idx_preset_build_components_component
    ON preset_build_components (component_id);
