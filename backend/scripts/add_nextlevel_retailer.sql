INSERT INTO retailers (name, base_url, country, is_active, scraping_interval_hours, notes)
VALUES ('NextLevel PC', 'https://nextlevelpc.ma', 'MA', true, 24, 'WooCommerce store - Casablanca, Rabat, Marrakech, Tanger')
ON CONFLICT (name) DO NOTHING
RETURNING id, name;
