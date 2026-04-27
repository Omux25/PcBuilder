-- Seed Retailers: Moroccan and regional PC hardware retailers
-- Safe to run multiple times — uses ON CONFLICT (name) DO NOTHING

INSERT INTO retailers (name, base_url, logo_url, country, is_active, scraping_interval_hours, notes)
VALUES
  ('Matelpro',    'https://www.matelpro.com',    NULL, 'MA', true, 24, 'Major Moroccan PC hardware retailer'),
  ('Tradeline',   'https://www.tradeline.ma',    NULL, 'MA', true, 24, 'Moroccan electronics and PC components'),
  ('Mytek',       'https://www.mytek.tn',        NULL, 'TN', true, 24, 'Tunisian retailer with wide component selection'),
  ('Wiki',        'https://www.wiki.tn',         NULL, 'TN', true, 24, 'Tunisian PC hardware and electronics'),
  ('Tunisianet',  'https://www.tunisianet.com.tn',NULL,'TN', true, 24, 'Large Tunisian online electronics store'),
  ('Electro Bazar','https://www.electrobazar.ma',NULL, 'MA', true, 24, 'Moroccan electronics retailer')
ON CONFLICT (name) DO NOTHING;
