-- Seed Retailers: revendeurs marocains de composants PC
-- Seuls UltraPC, NextLevel PC et SetupGame sont actifs (scrapers implémentés).
-- Les autres sont désactivés jusqu'à l'implémentation de leurs scrapers.
-- Safe to run multiple times — uses ON CONFLICT (name) DO NOTHING

INSERT INTO retailers (name, base_url, logo_url, country, is_active, scraping_interval_hours, notes)
VALUES
  ('UltraPC',      'https://www.ultrapc.ma',      NULL, 'MA', true,  24, 'Revendeur marocain — PrestaShop AJAX API'),
  ('NextLevel PC', 'https://nextlevelpc.ma',       NULL, 'MA', true,  24, 'Revendeur marocain — WooCommerce JSON-LD'),
  ('SetupGame',    'https://setupgame.ma',         NULL, 'MA', true,  24, 'Revendeur marocain — WooCommerce Store API'),
  ('Matelpro',     'https://www.matelpro.com',     NULL, 'MA', false, 24, 'Scraper non implémenté'),
  ('Tradeline',    'https://www.tradeline.ma',     NULL, 'MA', false, 24, 'Scraper non implémenté'),
  ('Mytek',        'https://www.mytek.tn',         NULL, 'TN', false, 24, 'Scraper non implémenté'),
  ('Wiki',         'https://www.wiki.tn',          NULL, 'TN', false, 24, 'Scraper non implémenté'),
  ('Tunisianet',   'https://www.tunisianet.com.tn',NULL, 'TN', false, 24, 'Scraper non implémenté'),
  ('Electro Bazar','https://www.electrobazar.ma',  NULL, 'MA', false, 24, 'Scraper non implémenté')
ON CONFLICT (name) DO NOTHING;

-- Désactiver tous les revendeurs sans scraper implémenté
UPDATE retailers SET is_active = false
WHERE name IN ('Matelpro', 'Tradeline', 'Mytek', 'Wiki', 'Tunisianet', 'Electro Bazar');

