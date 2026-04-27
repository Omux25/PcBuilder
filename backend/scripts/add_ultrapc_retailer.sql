INSERT INTO retailers (name, base_url, country, is_active, scraping_interval_hours, notes)
VALUES ('UltraPC', 'https://www.ultrapc.ma', 'MA', true, 24, 'PrestaShop store - Casablanca, Rabat, Marrakech, Agadir, Tanger')
ON CONFLICT (name) DO NOTHING
RETURNING id, name;
