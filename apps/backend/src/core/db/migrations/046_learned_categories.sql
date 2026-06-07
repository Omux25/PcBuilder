CREATE TABLE IF NOT EXISTS learned_categories (
    canonical_name TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual_correction',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learned_categories_category ON learned_categories(category);
