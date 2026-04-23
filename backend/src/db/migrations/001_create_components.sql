-- Migration 001: Create components table
-- Polymorphic table — category-specific columns are nullable.
-- The application layer (Zod schemas) enforces which columns are required
-- per category before any INSERT/UPDATE reaches the database.

CREATE TABLE IF NOT EXISTS components (
    id                   SERIAL PRIMARY KEY,
    name                 VARCHAR(255) NOT NULL,
    brand                VARCHAR(100),
    category             VARCHAR(50)  NOT NULL
                             CHECK (category IN (
                                 'cpu', 'motherboard', 'gpu', 'ram',
                                 'storage', 'psu', 'case'
                             )),

    -- CPU / Motherboard
    socket               VARCHAR(50),           -- e.g. AM5, LGA1700

    -- Motherboard
    supported_ram_types  VARCHAR(20)[],          -- e.g. {DDR4,DDR5}
    max_ram_frequency    INTEGER,               -- MHz

    -- RAM
    ram_type             VARCHAR(10),           -- DDR4 or DDR5
    frequency_mhz        INTEGER,

    -- GPU
    length_mm            INTEGER,              -- GPU length in mm

    -- Case
    max_gpu_length_mm    INTEGER,

    -- PSU
    wattage              INTEGER,              -- watts

    -- Common power field (NULL when not applicable, e.g. case/storage)
    tdp                  INTEGER,              -- watts

    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_components_category
    ON components (category);

CREATE INDEX IF NOT EXISTS idx_components_socket
    ON components (socket)
    WHERE socket IS NOT NULL;
