-- Migration 043: Alias Rules Engine
--
-- Creates the alias_rules table for admin-configurable string and regex replacements.
-- Seeding it with the initial Ryzen 3 3400G typo correction rule.

CREATE TABLE IF NOT EXISTS alias_rules (
    id          SERIAL PRIMARY KEY,
    pattern     VARCHAR(200) NOT NULL,
    replacement VARCHAR(200) NOT NULL,
    category    VARCHAR(50)  CHECK (category IN (
                    'cpu', 'gpu', 'ram', 'motherboard', 'storage',
                    'psu', 'case', 'cooling', 'fan', 'thermal_paste'
                )),
    is_regex    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    
    UNIQUE (pattern, category)
);

CREATE INDEX IF NOT EXISTS idx_alias_rules_category ON alias_rules (category);

-- Seed initial Ryzen 3 3400G typo correction
INSERT INTO alias_rules (pattern, replacement, category, is_regex) 
VALUES ('\\bryzen\\s+3\\s+3400g\\b', 'Ryzen 5 3400G', 'cpu', TRUE)
ON CONFLICT (pattern, category) DO NOTHING;
