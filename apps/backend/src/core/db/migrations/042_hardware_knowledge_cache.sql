-- Create hardware_knowledge_cache table
CREATE TABLE IF NOT EXISTS hardware_knowledge_cache (
  id SERIAL PRIMARY KEY,
  hardware_type TEXT NOT NULL, -- e.g., 'gpu', 'cpu'
  query_string TEXT UNIQUE NOT NULL, -- e.g., 'ASUS Phoenix RTX 3060 12GB'
  resolved_specs JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hardware_knowledge_cache_query ON hardware_knowledge_cache (query_string);
