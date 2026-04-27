INSERT INTO retailers (name, base_url, country, is_active, scraping_interval_hours, notes)
VALUES ('SetupGame', 'https://setupgame.ma', 'MA', true, 24, 'WooCommerce store - Tanger, Rabat, Casablanca, Marrakech')
ON CONFLICT (name) DO NOTHING
RETURNING id, name;
