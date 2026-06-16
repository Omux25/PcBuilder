-- Add auto_linked boolean to scraper_mappings

ALTER TABLE scraper_mappings ADD COLUMN IF NOT EXISTS auto_linked BOOLEAN DEFAULT false;
