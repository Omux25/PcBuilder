-- Add benchmark_score column to components to store a unified relative performance metric
-- This score is used for side-by-side comparisons (e.g. PassMark CPU Mark or PassMark G3D Mark)
ALTER TABLE components 
ADD COLUMN benchmark_score INTEGER DEFAULT NULL;

-- Create an index to potentially sort by performance
CREATE INDEX idx_components_benchmark_score ON components(benchmark_score) WHERE benchmark_score IS NOT NULL;
