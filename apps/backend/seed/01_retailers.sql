-- Seed Retailers: only the 3 retailers with implemented scrapers.
-- Safe to run multiple times — uses ON CONFLICT (name) DO NOTHING

INSERT INTO retailers (name, base_url, logo_url, country, is_active, scraping_interval_hours)
VALUES
  ('UltraPC',      'https://www.ultrapc.ma', NULL, 'MA', true, 24),
  ('NextLevel PC', 'https://nextlevelpc.ma', NULL, 'MA', true, 24),
  ('SetupGame',    'https://setupgame.ma',   NULL, 'MA', true, 24)
ON CONFLICT (name) DO NOTHING;
