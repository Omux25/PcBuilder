-- Migration 020: Add scraping_enabled column to retailers table
--
-- Separates "retailer is visible" (is_active) from "scheduler auto-scrapes this retailer"
-- (scraping_enabled). When scraping_enabled = false, the cron scheduler skips the
-- retailer but admins can still trigger a manual scrape from the admin panel.
--
-- Default: true — existing retailers keep their current behavior.

ALTER TABLE retailers
    ADD COLUMN IF NOT EXISTS scraping_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN retailers.scraping_enabled IS
    'When false, the cron scheduler skips this retailer. Manual scrapes from the admin panel are still allowed.';
