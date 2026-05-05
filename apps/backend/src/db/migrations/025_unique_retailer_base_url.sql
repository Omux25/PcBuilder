-- Migration 025: Add UNIQUE constraint on retailers.base_url
-- base_url is a more stable identifier than name for scraper-to-retailer mapping.
-- A scraper is tied to a domain, not a display name.

ALTER TABLE retailers
    ADD CONSTRAINT retailers_base_url_key UNIQUE (base_url);
