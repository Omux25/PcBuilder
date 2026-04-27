-- ── Retailers ────────────────────────────────────────────────────────────────
INSERT INTO retailers (name, base_url, active) VALUES
  ('Matelpro',   'https://www.matelpro.com',   true),
  ('Tradeline',  'https://www.tradeline.ma',   true),
  ('Mytek',      'https://www.mytek.ma',       true)
ON CONFLICT DO NOTHING;

-- ── CPUs ─────────────────────────────────────────────────────────────────────
INSERT INTO components (name, brand, category, socket, tdp) VALUES
  ('Ryzen 7 7700X',    'AMD',   'cpu', 'AM5',    105),
  ('Ryzen 9 7900X',    'AMD',   'cpu', 'AM5',    170),
  ('Core i5-13600K',   'Intel', 'cpu', 'LGA1700', 125),
  ('Core i7-13700K',   'Intel', 'cpu', 'LGA1700', 125),
  ('Core i9-13900K',   'Intel', 'cpu', 'LGA1700', 253)
ON CONFLICT DO NOTHING;

-- ── Motherboards ─────────────────────────────────────────────────────────────
INSERT INTO components (name, brand, category, socket, supported_ram_types, max_ram_frequency, tdp) VALUES
  ('ASUS ROG STRIX B650-A',    'ASUS',    'motherboard', 'AM5',    ARRAY['DDR5'],        6000, 50),
  ('MSI MAG B650 TOMAHAWK',    'MSI',     'motherboard', 'AM5',    ARRAY['DDR5'],        6000, 45),
  ('ASUS PRIME Z790-P',        'ASUS',    'motherboard', 'LGA1700',ARRAY['DDR4','DDR5'], 5600, 50),
  ('Gigabyte Z790 AORUS ELITE','Gigabyte','motherboard', 'LGA1700',ARRAY['DDR4','DDR5'], 6400, 55)
ON CONFLICT DO NOTHING;

-- ── GPUs ─────────────────────────────────────────────────────────────────────
INSERT INTO components (name, brand, category, length_mm, tdp) VALUES
  ('RTX 4070',       'NVIDIA', 'gpu', 285, 200),
  ('RTX 4070 Ti',    'NVIDIA', 'gpu', 336, 285),
  ('RTX 4080',       'NVIDIA', 'gpu', 336, 320),
  ('RX 7800 XT',     'AMD',    'gpu', 267, 263),
  ('RX 7900 XTX',    'AMD',    'gpu', 287, 355)
ON CONFLICT DO NOTHING;

-- ── RAM ──────────────────────────────────────────────────────────────────────
INSERT INTO components (name, brand, category, ram_type, frequency_mhz, tdp) VALUES
  ('Corsair Vengeance DDR5 32GB 5600MHz', 'Corsair', 'ram', 'DDR5', 5600, 10),
  ('G.Skill Trident Z5 DDR5 32GB 6000MHz','G.Skill', 'ram', 'DDR5', 6000, 12),
  ('Kingston Fury Beast DDR4 32GB 3200MHz','Kingston','ram', 'DDR4', 3200,  8),
  ('Corsair Vengeance DDR4 16GB 3600MHz', 'Corsair', 'ram', 'DDR4', 3600,  7)
ON CONFLICT DO NOTHING;

-- ── Storage ──────────────────────────────────────────────────────────────────
INSERT INTO components (name, brand, category, tdp) VALUES
  ('Samsung 980 PRO 1TB NVMe',  'Samsung', 'storage', 6),
  ('WD Black SN850X 1TB NVMe',  'WD',      'storage', 7),
  ('Seagate Barracuda 2TB HDD', 'Seagate', 'storage', 9)
ON CONFLICT DO NOTHING;

-- ── PSUs ─────────────────────────────────────────────────────────────────────
INSERT INTO components (name, brand, category, wattage) VALUES
  ('Corsair RM750x 750W 80+ Gold',  'Corsair', 'psu', 750),
  ('Corsair RM850x 850W 80+ Gold',  'Corsair', 'psu', 850),
  ('be quiet! Straight Power 1000W','be quiet!','psu',1000),
  ('EVGA SuperNOVA 650W 80+ Gold',  'EVGA',    'psu',  650)
ON CONFLICT DO NOTHING;

-- ── Cases ────────────────────────────────────────────────────────────────────
INSERT INTO components (name, brand, category, max_gpu_length_mm) VALUES
  ('NZXT H510 Mid Tower',       'NZXT',    'case', 381),
  ('Fractal Design Meshify C',  'Fractal', 'case', 315),
  ('Lian Li PC-O11 Dynamic',    'Lian Li', 'case', 420),
  ('Corsair 4000D Airflow',     'Corsair', 'case', 360)
ON CONFLICT DO NOTHING;

-- ── Sample prices (Matelpro = retailer 1) ────────────────────────────────────
INSERT INTO prices (component_id, retailer_id, price, in_stock, product_url, last_updated)
SELECT c.id, 1, p.price, p.in_stock, p.url, NOW()
FROM (VALUES
  ('Ryzen 7 7700X',                  2899.00, true,  'https://www.matelpro.com/ryzen-7-7700x'),
  ('Ryzen 9 7900X',                  4499.00, true,  'https://www.matelpro.com/ryzen-9-7900x'),
  ('Core i5-13600K',                 2199.00, true,  'https://www.matelpro.com/i5-13600k'),
  ('Core i7-13700K',                 3299.00, false, 'https://www.matelpro.com/i7-13700k'),
  ('RTX 4070',                       5999.00, true,  'https://www.matelpro.com/rtx-4070'),
  ('RTX 4080',                      11999.00, true,  'https://www.matelpro.com/rtx-4080'),
  ('RX 7800 XT',                     5499.00, true,  'https://www.matelpro.com/rx-7800-xt'),
  ('Corsair Vengeance DDR5 32GB 5600MHz', 899.00, true, 'https://www.matelpro.com/ddr5-32gb'),
  ('Samsung 980 PRO 1TB NVMe',        799.00, true,  'https://www.matelpro.com/980-pro'),
  ('Corsair RM850x 850W 80+ Gold',   1099.00, true,  'https://www.matelpro.com/rm850x'),
  ('NZXT H510 Mid Tower',             699.00, true,  'https://www.matelpro.com/h510'),
  ('ASUS ROG STRIX B650-A',          2199.00, true,  'https://www.matelpro.com/b650-a')
) AS p(name, price, in_stock, url)
JOIN components c ON c.name = p.name
ON CONFLICT (component_id, retailer_id) DO UPDATE SET
  price = EXCLUDED.price, in_stock = EXCLUDED.in_stock,
  product_url = EXCLUDED.product_url, last_updated = NOW();

-- ── Sample prices (Tradeline = retailer 2) ───────────────────────────────────
INSERT INTO prices (component_id, retailer_id, price, in_stock, product_url, last_updated)
SELECT c.id, 2, p.price, p.in_stock, p.url, NOW()
FROM (VALUES
  ('Ryzen 7 7700X',                  2799.00, true,  'https://www.tradeline.ma/ryzen-7-7700x'),
  ('Core i5-13600K',                 2099.00, true,  'https://www.tradeline.ma/i5-13600k'),
  ('RTX 4070',                       6199.00, false, 'https://www.tradeline.ma/rtx-4070'),
  ('RX 7800 XT',                     5299.00, true,  'https://www.tradeline.ma/rx-7800-xt'),
  ('Corsair Vengeance DDR5 32GB 5600MHz', 849.00, true, 'https://www.tradeline.ma/ddr5-32gb'),
  ('Samsung 980 PRO 1TB NVMe',        749.00, true,  'https://www.tradeline.ma/980-pro'),
  ('Corsair RM850x 850W 80+ Gold',   1049.00, false, 'https://www.tradeline.ma/rm850x'),
  ('ASUS ROG STRIX B650-A',          2099.00, true,  'https://www.tradeline.ma/b650-a')
) AS p(name, price, in_stock, url)
JOIN components c ON c.name = p.name
ON CONFLICT (component_id, retailer_id) DO UPDATE SET
  price = EXCLUDED.price, in_stock = EXCLUDED.in_stock,
  product_url = EXCLUDED.product_url, last_updated = NOW();

-- ── Admin account (password: admin123) ───────────────────────────────────────
-- bcrypt hash of 'admin123' with 10 rounds
INSERT INTO admins (username, password_hash) VALUES
  ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
ON CONFLICT DO NOTHING;
