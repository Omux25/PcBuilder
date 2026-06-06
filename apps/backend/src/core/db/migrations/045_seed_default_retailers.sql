-- Migration 045: Seed default retailers
-- Adds the 4 default retailers supported by our scrapers: Next Level PC, PC Gamer Casa, Setup Game, Ultra PC

INSERT INTO retailers (name, base_url, is_active, logo_url)
VALUES 
    ('Next Level PC', 'https://nextlevelpc.ma', true, 'https://nextlevelpc.ma/wp-content/uploads/2023/02/Next-Level-PC-Logo-1.png'),
    ('PC Gamer Casa', 'https://pcgamercasa.ma', true, 'https://pcgamercasa.ma/wp-content/uploads/2021/04/logo-pcgamercasa.png'),
    ('Setup Game', 'https://setupgame.ma', true, 'https://setupgame.ma/wp-content/uploads/2023/01/logo-setupgame.png'),
    ('Ultra PC', 'https://www.ultrapc.ma', true, 'https://www.ultrapc.ma/img/ultrapc-sarl-logo-1623942007.jpg')
ON CONFLICT (base_url) DO NOTHING;
