-- Seed Catalog: 150+ real-world PC components for the Moroccan market
-- Safe to run multiple times — uses ON CONFLICT (slug) DO NOTHING
-- Categories: cpu (20), motherboard (18), gpu (25), ram (20),
--             storage (20), psu (18), case (15), cooling (14)
-- Total: 150 components

-- ─────────────────────────────────────────────────────────────────────────────
-- CPUs (20)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, socket, tdp, specs, release_year, is_active) VALUES
('amd-ryzen-5-5600',       'Ryzen 5 5600',       'AMD',   'cpu', 'AM4',    65,  '{"socket":"AM4","cores":6,"threads":12,"base_clock_ghz":3.5,"boost_clock_ghz":4.4,"tdp":65}',   2021, true),
('amd-ryzen-5-5600x',      'Ryzen 5 5600X',      'AMD',   'cpu', 'AM4',    65,  '{"socket":"AM4","cores":6,"threads":12,"base_clock_ghz":3.7,"boost_clock_ghz":4.6,"tdp":65}',   2020, true),
('amd-ryzen-5-7600',       'Ryzen 5 7600',       'AMD',   'cpu', 'AM5',    65,  '{"socket":"AM5","cores":6,"threads":12,"base_clock_ghz":3.8,"boost_clock_ghz":5.1,"tdp":65}',   2023, true),
('amd-ryzen-5-7600x',      'Ryzen 5 7600X',      'AMD',   'cpu', 'AM5',   105,  '{"socket":"AM5","cores":6,"threads":12,"base_clock_ghz":4.7,"boost_clock_ghz":5.3,"tdp":105}',  2022, true),
('amd-ryzen-7-5700x',      'Ryzen 7 5700X',      'AMD',   'cpu', 'AM4',    65,  '{"socket":"AM4","cores":8,"threads":16,"base_clock_ghz":3.4,"boost_clock_ghz":4.6,"tdp":65}',   2022, true),
('amd-ryzen-7-7700',       'Ryzen 7 7700',       'AMD',   'cpu', 'AM5',    65,  '{"socket":"AM5","cores":8,"threads":16,"base_clock_ghz":3.8,"boost_clock_ghz":5.3,"tdp":65}',   2023, true),
('amd-ryzen-7-7700x',      'Ryzen 7 7700X',      'AMD',   'cpu', 'AM5',   105,  '{"socket":"AM5","cores":8,"threads":16,"base_clock_ghz":4.5,"boost_clock_ghz":5.4,"tdp":105}',  2022, true),
('amd-ryzen-9-7900x',      'Ryzen 9 7900X',      'AMD',   'cpu', 'AM5',   170,  '{"socket":"AM5","cores":12,"threads":24,"base_clock_ghz":4.7,"boost_clock_ghz":5.6,"tdp":170}', 2022, true),
('amd-ryzen-9-7950x',      'Ryzen 9 7950X',      'AMD',   'cpu', 'AM5',   170,  '{"socket":"AM5","cores":16,"threads":32,"base_clock_ghz":4.5,"boost_clock_ghz":5.7,"tdp":170}', 2022, true),
('amd-ryzen-5-8600g',      'Ryzen 5 8600G',      'AMD',   'cpu', 'AM5',    65,  '{"socket":"AM5","cores":6,"threads":12,"base_clock_ghz":4.3,"boost_clock_ghz":5.0,"tdp":65}',   2024, true),
('intel-core-i3-12100f',   'Core i3-12100F',     'Intel', 'cpu', 'LGA1700', 58, '{"socket":"LGA1700","cores":4,"threads":8,"base_clock_ghz":3.3,"boost_clock_ghz":4.3,"tdp":58}',  2022, true),
('intel-core-i5-12400f',   'Core i5-12400F',     'Intel', 'cpu', 'LGA1700', 65, '{"socket":"LGA1700","cores":6,"threads":12,"base_clock_ghz":2.5,"boost_clock_ghz":4.4,"tdp":65}', 2022, true),
('intel-core-i5-13400f',   'Core i5-13400F',     'Intel', 'cpu', 'LGA1700', 65, '{"socket":"LGA1700","cores":10,"threads":16,"base_clock_ghz":2.5,"boost_clock_ghz":4.6,"tdp":65}',2023, true),
('intel-core-i5-13600k',   'Core i5-13600K',     'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":14,"threads":20,"base_clock_ghz":3.5,"boost_clock_ghz":5.1,"tdp":125}',2022, true),
('intel-core-i7-13700k',   'Core i7-13700K',     'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":16,"threads":24,"base_clock_ghz":3.4,"boost_clock_ghz":5.4,"tdp":125}',2022, true),
('intel-core-i9-13900k',   'Core i9-13900K',     'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":24,"threads":32,"base_clock_ghz":3.0,"boost_clock_ghz":5.8,"tdp":125}',2022, true),
('intel-core-i5-14600k',   'Core i5-14600K',     'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":14,"threads":20,"base_clock_ghz":3.5,"boost_clock_ghz":5.3,"tdp":125}',2023, true),
('intel-core-i7-14700k',   'Core i7-14700K',     'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":20,"threads":28,"base_clock_ghz":3.4,"boost_clock_ghz":5.6,"tdp":125}',2023, true),
('intel-core-i9-14900k',   'Core i9-14900K',     'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":24,"threads":32,"base_clock_ghz":3.2,"boost_clock_ghz":6.0,"tdp":125}',2023, true),
('intel-core-i5-12600k',   'Core i5-12600K',     'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":10,"threads":16,"base_clock_ghz":3.7,"boost_clock_ghz":4.9,"tdp":125}',2021, true)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Motherboards (18)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, socket, supported_ram_types, max_ram_frequency, specs, release_year, is_active) VALUES
('msi-b450-tomahawk-max',        'B450 TOMAHAWK MAX',        'MSI',      'motherboard', 'AM4',    ARRAY['DDR4'], 4400, '{"socket":"AM4","chipset":"B450","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":4400}',   2019, true),
('msi-b550-a-pro',               'B550-A PRO',               'MSI',      'motherboard', 'AM4',    ARRAY['DDR4'], 4866, '{"socket":"AM4","chipset":"B550","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":4866}',   2020, true),
('asus-rog-strix-b550-f',        'ROG STRIX B550-F',         'ASUS',     'motherboard', 'AM4',    ARRAY['DDR4'], 5100, '{"socket":"AM4","chipset":"B550","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":5100}',   2020, true),
('gigabyte-b550-aorus-elite',    'B550 AORUS ELITE',         'Gigabyte', 'motherboard', 'AM4',    ARRAY['DDR4'], 5000, '{"socket":"AM4","chipset":"B550","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":5000}',   2020, true),
('msi-b650-gaming-plus-wifi',    'B650 GAMING PLUS WIFI',    'MSI',      'motherboard', 'AM5',    ARRAY['DDR5'], 6000, '{"socket":"AM5","chipset":"B650","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":6000}',   2022, true),
('asus-prime-b650-plus',         'PRIME B650-PLUS',          'ASUS',     'motherboard', 'AM5',    ARRAY['DDR5'], 6400, '{"socket":"AM5","chipset":"B650","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":6400}',   2022, true),
('gigabyte-b650-aorus-elite-ax', 'B650 AORUS ELITE AX',      'Gigabyte', 'motherboard', 'AM5',    ARRAY['DDR5'], 6400, '{"socket":"AM5","chipset":"B650","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":6400}',   2022, true),
('msi-x670e-ace',                'MEG X670E ACE',            'MSI',      'motherboard', 'AM5',    ARRAY['DDR5'], 6800, '{"socket":"AM5","chipset":"X670E","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":6800}',  2022, true),
('asus-rog-crosshair-x670e',     'ROG CROSSHAIR X670E HERO', 'ASUS',     'motherboard', 'AM5',    ARRAY['DDR5'], 6800, '{"socket":"AM5","chipset":"X670E","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":6800}',  2022, true),
('msi-pro-b760m-a-wifi',         'PRO B760M-A WIFI',         'MSI',      'motherboard', 'LGA1700',ARRAY['DDR4','DDR5'], 5600, '{"socket":"LGA1700","chipset":"B760","form_factor":"mATX","ram_slots":2,"max_ram_gb":64,"supported_ram_types":["DDR4","DDR5"],"max_ram_frequency":5600}', 2023, true),
('asus-prime-b760-plus',         'PRIME B760-PLUS',          'ASUS',     'motherboard', 'LGA1700',ARRAY['DDR4','DDR5'], 5600, '{"socket":"LGA1700","chipset":"B760","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4","DDR5"],"max_ram_frequency":5600}', 2023, true),
('gigabyte-b760-ds3h',           'B760 DS3H',                'Gigabyte', 'motherboard', 'LGA1700',ARRAY['DDR4'], 5333, '{"socket":"LGA1700","chipset":"B760","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":5333}', 2023, true),
('msi-z790-tomahawk-wifi',       'MAG Z790 TOMAHAWK WIFI',   'MSI',      'motherboard', 'LGA1700',ARRAY['DDR5'], 7200, '{"socket":"LGA1700","chipset":"Z790","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":7200}', 2022, true),
('asus-rog-strix-z790-e',        'ROG STRIX Z790-E GAMING',  'ASUS',     'motherboard', 'LGA1700',ARRAY['DDR5'], 7200, '{"socket":"LGA1700","chipset":"Z790","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":7200}', 2022, true),
('gigabyte-z790-aorus-master',   'Z790 AORUS MASTER',        'Gigabyte', 'motherboard', 'LGA1700',ARRAY['DDR5'], 7600, '{"socket":"LGA1700","chipset":"Z790","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":7600}', 2022, true),
('msi-b550m-pro-vdh-wifi',       'B550M PRO-VDH WIFI',       'MSI',      'motherboard', 'AM4',    ARRAY['DDR4'], 4800, '{"socket":"AM4","chipset":"B550","form_factor":"mATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":4800}',   2020, true),
('asrock-b650m-pro-rs',          'B650M Pro RS',             'ASRock',   'motherboard', 'AM5',    ARRAY['DDR5'], 6400, '{"socket":"AM5","chipset":"B650","form_factor":"mATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":6400}',   2022, true),
('asrock-b760m-pro-rs',          'B760M Pro RS',             'ASRock',   'motherboard', 'LGA1700',ARRAY['DDR4','DDR5'], 5600, '{"socket":"LGA1700","chipset":"B760","form_factor":"mATX","ram_slots":4,"max_ram_gb":64,"supported_ram_types":["DDR4","DDR5"],"max_ram_frequency":5600}', 2023, true)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- GPUs (25)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, length_mm, tdp, specs, release_year, is_active) VALUES
('amd-rx-6600',          'Radeon RX 6600',          'AMD',    'gpu', 160, 132, '{"chipset":"Navi 23","vram_gb":8,"length_mm":160,"tdp":132,"pcie_version":"4.0"}',  2021, true),
('amd-rx-6600-xt',       'Radeon RX 6600 XT',       'AMD',    'gpu', 160, 160, '{"chipset":"Navi 23","vram_gb":8,"length_mm":160,"tdp":160,"pcie_version":"4.0"}',  2021, true),
('amd-rx-6700-xt',       'Radeon RX 6700 XT',       'AMD',    'gpu', 267, 230, '{"chipset":"Navi 22","vram_gb":12,"length_mm":267,"tdp":230,"pcie_version":"4.0"}', 2021, true),
('amd-rx-6750-xt',       'Radeon RX 6750 XT',       'AMD',    'gpu', 267, 250, '{"chipset":"Navi 22","vram_gb":12,"length_mm":267,"tdp":250,"pcie_version":"4.0"}', 2022, true),
('amd-rx-6800-xt',       'Radeon RX 6800 XT',       'AMD',    'gpu', 267, 300, '{"chipset":"Navi 21","vram_gb":16,"length_mm":267,"tdp":300,"pcie_version":"4.0"}', 2020, true),
('amd-rx-7600',          'Radeon RX 7600',          'AMD',    'gpu', 200, 165, '{"chipset":"Navi 33","vram_gb":8,"length_mm":200,"tdp":165,"pcie_version":"4.0"}',  2023, true),
('amd-rx-7700-xt',       'Radeon RX 7700 XT',       'AMD',    'gpu', 267, 245, '{"chipset":"Navi 32","vram_gb":12,"length_mm":267,"tdp":245,"pcie_version":"4.0"}', 2023, true),
('amd-rx-7800-xt',       'Radeon RX 7800 XT',       'AMD',    'gpu', 267, 263, '{"chipset":"Navi 32","vram_gb":16,"length_mm":267,"tdp":263,"pcie_version":"4.0"}', 2023, true),
('amd-rx-7900-xt',       'Radeon RX 7900 XT',       'AMD',    'gpu', 287, 315, '{"chipset":"Navi 31","vram_gb":20,"length_mm":287,"tdp":315,"pcie_version":"4.0"}', 2022, true),
('amd-rx-7900-xtx',      'Radeon RX 7900 XTX',      'AMD',    'gpu', 287, 355, '{"chipset":"Navi 31","vram_gb":24,"length_mm":287,"tdp":355,"pcie_version":"4.0"}', 2022, true),
('nvidia-rtx-3060',      'GeForce RTX 3060',        'NVIDIA', 'gpu', 242, 170, '{"chipset":"GA106","vram_gb":12,"length_mm":242,"tdp":170,"pcie_version":"4.0"}',   2021, true),
('nvidia-rtx-3060-ti',   'GeForce RTX 3060 Ti',     'NVIDIA', 'gpu', 242, 200, '{"chipset":"GA104","vram_gb":8,"length_mm":242,"tdp":200,"pcie_version":"4.0"}',    2020, true),
('nvidia-rtx-3070',      'GeForce RTX 3070',        'NVIDIA', 'gpu', 242, 220, '{"chipset":"GA104","vram_gb":8,"length_mm":242,"tdp":220,"pcie_version":"4.0"}',    2020, true),
('nvidia-rtx-3080',      'GeForce RTX 3080',        'NVIDIA', 'gpu', 285, 320, '{"chipset":"GA102","vram_gb":10,"length_mm":285,"tdp":320,"pcie_version":"4.0"}',   2020, true),
('nvidia-rtx-4060',      'GeForce RTX 4060',        'NVIDIA', 'gpu', 240, 115, '{"chipset":"AD107","vram_gb":8,"length_mm":240,"tdp":115,"pcie_version":"4.0"}',    2023, true),
('nvidia-rtx-4060-ti',   'GeForce RTX 4060 Ti',     'NVIDIA', 'gpu', 240, 165, '{"chipset":"AD106","vram_gb":8,"length_mm":240,"tdp":165,"pcie_version":"4.0"}',    2023, true),
('nvidia-rtx-4070',      'GeForce RTX 4070',        'NVIDIA', 'gpu', 244, 200, '{"chipset":"AD104","vram_gb":12,"length_mm":244,"tdp":200,"pcie_version":"4.0"}',   2023, true),
('nvidia-rtx-4070-super','GeForce RTX 4070 SUPER',  'NVIDIA', 'gpu', 244, 220, '{"chipset":"AD104","vram_gb":12,"length_mm":244,"tdp":220,"pcie_version":"4.0"}',   2024, true),
('nvidia-rtx-4070-ti',   'GeForce RTX 4070 Ti',     'NVIDIA', 'gpu', 285, 285, '{"chipset":"AD104","vram_gb":12,"length_mm":285,"tdp":285,"pcie_version":"4.0"}',   2023, true),
('nvidia-rtx-4080',      'GeForce RTX 4080',        'NVIDIA', 'gpu', 336, 320, '{"chipset":"AD103","vram_gb":16,"length_mm":336,"tdp":320,"pcie_version":"4.0"}',   2022, true),
('nvidia-rtx-4090',      'GeForce RTX 4090',        'NVIDIA', 'gpu', 336, 450, '{"chipset":"AD102","vram_gb":24,"length_mm":336,"tdp":450,"pcie_version":"4.0"}',   2022, true),
('nvidia-rtx-3050',      'GeForce RTX 3050',        'NVIDIA', 'gpu', 200, 130, '{"chipset":"GA106","vram_gb":8,"length_mm":200,"tdp":130,"pcie_version":"4.0"}',    2022, true),
('amd-rx-6500-xt',       'Radeon RX 6500 XT',       'AMD',    'gpu', 160, 107, '{"chipset":"Navi 24","vram_gb":4,"length_mm":160,"tdp":107,"pcie_version":"4.0"}',  2022, true),
('nvidia-rtx-4060-8gb',  'GeForce RTX 4060 8GB',    'NVIDIA', 'gpu', 240, 115, '{"chipset":"AD107","vram_gb":8,"length_mm":240,"tdp":115,"pcie_version":"4.0"}',    2023, true),
('amd-rx-7600-xt',       'Radeon RX 7600 XT',       'AMD',    'gpu', 200, 190, '{"chipset":"Navi 33","vram_gb":16,"length_mm":200,"tdp":190,"pcie_version":"4.0"}', 2025, true)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- RAM (20)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, ram_type, frequency_mhz, specs, release_year, is_active) VALUES
('corsair-vengeance-lpx-16gb-ddr4-3200',  'Vengeance LPX 16GB DDR4-3200',  'Corsair',  'ram', 'DDR4', 3200, '{"ram_type":"DDR4","capacity_gb":16,"frequency_mhz":3200,"cas_latency":16,"voltage":1.35,"kit":"2x8GB"}',  2017, true),
('corsair-vengeance-lpx-32gb-ddr4-3200',  'Vengeance LPX 32GB DDR4-3200',  'Corsair',  'ram', 'DDR4', 3200, '{"ram_type":"DDR4","capacity_gb":32,"frequency_mhz":3200,"cas_latency":16,"voltage":1.35,"kit":"2x16GB"}', 2017, true),
('gskill-ripjaws-v-16gb-ddr4-3600',       'Ripjaws V 16GB DDR4-3600',       'G.Skill',  'ram', 'DDR4', 3600, '{"ram_type":"DDR4","capacity_gb":16,"frequency_mhz":3600,"cas_latency":16,"voltage":1.35,"kit":"2x8GB"}',  2018, true),
('gskill-ripjaws-v-32gb-ddr4-3600',       'Ripjaws V 32GB DDR4-3600',       'G.Skill',  'ram', 'DDR4', 3600, '{"ram_type":"DDR4","capacity_gb":32,"frequency_mhz":3600,"cas_latency":16,"voltage":1.35,"kit":"2x16GB"}', 2018, true),
('kingston-fury-beast-16gb-ddr4-3200',    'FURY Beast 16GB DDR4-3200',      'Kingston', 'ram', 'DDR4', 3200, '{"ram_type":"DDR4","capacity_gb":16,"frequency_mhz":3200,"cas_latency":16,"voltage":1.35,"kit":"2x8GB"}',  2020, true),
('kingston-fury-beast-32gb-ddr4-3200',    'FURY Beast 32GB DDR4-3200',      'Kingston', 'ram', 'DDR4', 3200, '{"ram_type":"DDR4","capacity_gb":32,"frequency_mhz":3200,"cas_latency":16,"voltage":1.35,"kit":"2x16GB"}', 2020, true),
('teamgroup-t-force-vulcan-16gb-ddr4-3200','T-Force Vulcan 16GB DDR4-3200', 'TeamGroup','ram', 'DDR4', 3200, '{"ram_type":"DDR4","capacity_gb":16,"frequency_mhz":3200,"cas_latency":16,"voltage":1.35,"kit":"2x8GB"}',  2019, true),
('corsair-vengeance-ddr5-32gb-5600',      'Vengeance DDR5-5600 32GB',       'Corsair',  'ram', 'DDR5', 5600, '{"ram_type":"DDR5","capacity_gb":32,"frequency_mhz":5600,"cas_latency":36,"voltage":1.25,"kit":"2x16GB"}', 2022, true),
('corsair-vengeance-ddr5-64gb-5600',      'Vengeance DDR5-5600 64GB',       'Corsair',  'ram', 'DDR5', 5600, '{"ram_type":"DDR5","capacity_gb":64,"frequency_mhz":5600,"cas_latency":36,"voltage":1.25,"kit":"2x32GB"}', 2022, true),
('gskill-trident-z5-32gb-ddr5-6000',      'Trident Z5 32GB DDR5-6000',      'G.Skill',  'ram', 'DDR5', 6000, '{"ram_type":"DDR5","capacity_gb":32,"frequency_mhz":6000,"cas_latency":30,"voltage":1.35,"kit":"2x16GB"}', 2022, true),
('gskill-trident-z5-64gb-ddr5-6000',      'Trident Z5 64GB DDR5-6000',      'G.Skill',  'ram', 'DDR5', 6000, '{"ram_type":"DDR5","capacity_gb":64,"frequency_mhz":6000,"cas_latency":30,"voltage":1.35,"kit":"2x32GB"}', 2022, true),
('kingston-fury-beast-32gb-ddr5-5200',    'FURY Beast 32GB DDR5-5200',      'Kingston', 'ram', 'DDR5', 5200, '{"ram_type":"DDR5","capacity_gb":32,"frequency_mhz":5200,"cas_latency":40,"voltage":1.1,"kit":"2x16GB"}',  2022, true),
('kingston-fury-beast-16gb-ddr5-5200',    'FURY Beast 16GB DDR5-5200',      'Kingston', 'ram', 'DDR5', 5200, '{"ram_type":"DDR5","capacity_gb":16,"frequency_mhz":5200,"cas_latency":40,"voltage":1.1,"kit":"2x8GB"}',   2022, true),
('corsair-vengeance-lpx-8gb-ddr4-3200',   'Vengeance LPX 8GB DDR4-3200',   'Corsair',  'ram', 'DDR4', 3200, '{"ram_type":"DDR4","capacity_gb":8,"frequency_mhz":3200,"cas_latency":16,"voltage":1.35,"kit":"1x8GB"}',   2017, true),
('gskill-flare-x5-32gb-ddr5-6000',        'Flare X5 32GB DDR5-6000',        'G.Skill',  'ram', 'DDR5', 6000, '{"ram_type":"DDR5","capacity_gb":32,"frequency_mhz":6000,"cas_latency":30,"voltage":1.35,"kit":"2x16GB"}', 2022, true),
('teamgroup-t-force-delta-32gb-ddr5-6000','T-Force Delta 32GB DDR5-6000',   'TeamGroup','ram', 'DDR5', 6000, '{"ram_type":"DDR5","capacity_gb":32,"frequency_mhz":6000,"cas_latency":38,"voltage":1.35,"kit":"2x16GB"}', 2022, true),
('corsair-vengeance-lpx-16gb-ddr4-2666',  'Vengeance LPX 16GB DDR4-2666',  'Corsair',  'ram', 'DDR4', 2666, '{"ram_type":"DDR4","capacity_gb":16,"frequency_mhz":2666,"cas_latency":16,"voltage":1.2,"kit":"2x8GB"}',   2016, true),
('kingston-valueram-8gb-ddr4-2666',       'ValueRAM 8GB DDR4-2666',         'Kingston', 'ram', 'DDR4', 2666, '{"ram_type":"DDR4","capacity_gb":8,"frequency_mhz":2666,"cas_latency":19,"voltage":1.2,"kit":"1x8GB"}',    2018, true),
('corsair-dominator-platinum-32gb-ddr5-5600','Dominator Platinum 32GB DDR5-5600','Corsair','ram','DDR5',5600,'{"ram_type":"DDR5","capacity_gb":32,"frequency_mhz":5600,"cas_latency":36,"voltage":1.25,"kit":"2x16GB"}',  2022, true)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Storage (20)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('samsung-970-evo-plus-500gb',    '970 EVO Plus 500GB',    'Samsung',  'storage', '{"type":"NVMe SSD","capacity_gb":500,"interface":"M.2 PCIe 3.0 x4","read_speed_mbps":3500,"write_speed_mbps":3200}',  2019, true),
('samsung-970-evo-plus-1tb',      '970 EVO Plus 1TB',      'Samsung',  'storage', '{"type":"NVMe SSD","capacity_gb":1000,"interface":"M.2 PCIe 3.0 x4","read_speed_mbps":3500,"write_speed_mbps":3300}', 2019, true),
('samsung-980-pro-1tb',           '980 PRO 1TB',           'Samsung',  'storage', '{"type":"NVMe SSD","capacity_gb":1000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7000,"write_speed_mbps":5000}', 2020, true),
('samsung-980-pro-2tb',           '980 PRO 2TB',           'Samsung',  'storage', '{"type":"NVMe SSD","capacity_gb":2000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7000,"write_speed_mbps":5100}', 2021, true),
('samsung-990-pro-1tb',           '990 PRO 1TB',           'Samsung',  'storage', '{"type":"NVMe SSD","capacity_gb":1000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7450,"write_speed_mbps":6900}', 2022, true),
('wd-black-sn770-1tb',            'WD_BLACK SN770 1TB',    'WD',       'storage', '{"type":"NVMe SSD","capacity_gb":1000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":5150,"write_speed_mbps":4900}', 2022, true),
('wd-black-sn770-2tb',            'WD_BLACK SN770 2TB',    'WD',       'storage', '{"type":"NVMe SSD","capacity_gb":2000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":5150,"write_speed_mbps":4850}', 2022, true),
('wd-blue-sn570-1tb',             'WD Blue SN570 1TB',     'WD',       'storage', '{"type":"NVMe SSD","capacity_gb":1000,"interface":"M.2 PCIe 3.0 x4","read_speed_mbps":3500,"write_speed_mbps":3000}', 2021, true),
('seagate-barracuda-2tb-hdd',     'BarraCuda 2TB HDD',     'Seagate',  'storage', '{"type":"HDD","capacity_gb":2000,"interface":"SATA 6Gb/s","read_speed_mbps":190,"write_speed_mbps":190}',             2020, true),
('seagate-barracuda-4tb-hdd',     'BarraCuda 4TB HDD',     'Seagate',  'storage', '{"type":"HDD","capacity_gb":4000,"interface":"SATA 6Gb/s","read_speed_mbps":190,"write_speed_mbps":190}',             2020, true),
('crucial-mx500-1tb-sata',        'MX500 1TB SATA SSD',    'Crucial',  'storage', '{"type":"SATA SSD","capacity_gb":1000,"interface":"SATA 6Gb/s","read_speed_mbps":560,"write_speed_mbps":510}',        2018, true),
('crucial-mx500-500gb-sata',      'MX500 500GB SATA SSD',  'Crucial',  'storage', '{"type":"SATA SSD","capacity_gb":500,"interface":"SATA 6Gb/s","read_speed_mbps":560,"write_speed_mbps":510}',         2018, true),
('kingston-nv2-1tb',              'NV2 1TB NVMe',          'Kingston', 'storage', '{"type":"NVMe SSD","capacity_gb":1000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":3500,"write_speed_mbps":2100}', 2022, true),
('kingston-nv2-2tb',              'NV2 2TB NVMe',          'Kingston', 'storage', '{"type":"NVMe SSD","capacity_gb":2000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":3500,"write_speed_mbps":2800}', 2022, true),
('samsung-870-evo-1tb-sata',      '870 EVO 1TB SATA SSD',  'Samsung',  'storage', '{"type":"SATA SSD","capacity_gb":1000,"interface":"SATA 6Gb/s","read_speed_mbps":560,"write_speed_mbps":530}',        2021, true),
('wd-blue-1tb-sata-ssd',          'WD Blue 1TB SATA SSD',  'WD',       'storage', '{"type":"SATA SSD","capacity_gb":1000,"interface":"SATA 6Gb/s","read_speed_mbps":560,"write_speed_mbps":530}',        2020, true),
('seagate-ironwolf-4tb-nas',      'IronWolf 4TB NAS HDD',  'Seagate',  'storage', '{"type":"HDD","capacity_gb":4000,"interface":"SATA 6Gb/s","read_speed_mbps":210,"write_speed_mbps":210}',             2020, true),
('crucial-p3-1tb-nvme',           'P3 1TB NVMe',           'Crucial',  'storage', '{"type":"NVMe SSD","capacity_gb":1000,"interface":"M.2 PCIe 3.0 x4","read_speed_mbps":3500,"write_speed_mbps":3000}', 2022, true),
('wd-black-sn850x-1tb',           'WD_BLACK SN850X 1TB',   'WD',       'storage', '{"type":"NVMe SSD","capacity_gb":1000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7300,"write_speed_mbps":6600}', 2022, true),
('samsung-990-evo-1tb',           '990 EVO 1TB',           'Samsung',  'storage', '{"type":"NVMe SSD","capacity_gb":1000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":5000,"write_speed_mbps":4200}', 2024, true)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- PSUs (18)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, wattage, specs, release_year, is_active) VALUES
('corsair-cv550',                'CV550 550W',                'Corsair',  'psu', 550,  '{"wattage":550,"efficiency_rating":"80+ Bronze","modular":"Non-modular","form_factor":"ATX"}',  2020, true),
('corsair-cx650m',               'CX650M 650W',               'Corsair',  'psu', 650,  '{"wattage":650,"efficiency_rating":"80+ Bronze","modular":"Semi-modular","form_factor":"ATX"}', 2020, true),
('corsair-rm750x',               'RM750x 750W',               'Corsair',  'psu', 750,  '{"wattage":750,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',  2021, true),
('corsair-rm850x',               'RM850x 850W',               'Corsair',  'psu', 850,  '{"wattage":850,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',  2021, true),
('corsair-rm1000x',              'RM1000x 1000W',             'Corsair',  'psu', 1000, '{"wattage":1000,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}', 2021, true),
('be-quiet-pure-power-11-550w',  'Pure Power 11 550W',        'be quiet!','psu', 550,  '{"wattage":550,"efficiency_rating":"80+ Gold","modular":"Semi-modular","form_factor":"ATX"}',  2019, true),
('be-quiet-pure-power-11-650w',  'Pure Power 11 650W',        'be quiet!','psu', 650,  '{"wattage":650,"efficiency_rating":"80+ Gold","modular":"Semi-modular","form_factor":"ATX"}',  2019, true),
('be-quiet-straight-power-11-750w','Straight Power 11 750W',  'be quiet!','psu', 750,  '{"wattage":750,"efficiency_rating":"80+ Platinum","modular":"Fully modular","form_factor":"ATX"}', 2019, true),
('be-quiet-dark-power-13-850w',  'Dark Power 13 850W',        'be quiet!','psu', 850,  '{"wattage":850,"efficiency_rating":"80+ Titanium","modular":"Fully modular","form_factor":"ATX"}', 2022, true),
('seasonic-focus-gx-650',        'Focus GX-650 650W',         'Seasonic', 'psu', 650,  '{"wattage":650,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',  2019, true),
('seasonic-focus-gx-750',        'Focus GX-750 750W',         'Seasonic', 'psu', 750,  '{"wattage":750,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',  2019, true),
('seasonic-focus-gx-850',        'Focus GX-850 850W',         'Seasonic', 'psu', 850,  '{"wattage":850,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',  2019, true),
('evga-supernova-650-g6',        'SuperNOVA 650 G6',          'EVGA',     'psu', 650,  '{"wattage":650,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',  2020, true),
('evga-supernova-750-g6',        'SuperNOVA 750 G6',          'EVGA',     'psu', 750,  '{"wattage":750,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',  2020, true),
('msi-mag-a650bn',               'MAG A650BN 650W',           'MSI',      'psu', 650,  '{"wattage":650,"efficiency_rating":"80+ Bronze","modular":"Non-modular","form_factor":"ATX"}',  2022, true),
('msi-mag-a750gl',               'MAG A750GL 750W',           'MSI',      'psu', 750,  '{"wattage":750,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',  2022, true),
('asus-rog-strix-850g',          'ROG STRIX 850G',            'ASUS',     'psu', 850,  '{"wattage":850,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',  2021, true),
('corsair-sf750',                'SF750 750W SFX',            'Corsair',  'psu', 750,  '{"wattage":750,"efficiency_rating":"80+ Platinum","modular":"Fully modular","form_factor":"SFX"}', 2019, true)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Cases (15)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, max_gpu_length_mm, specs, release_year, is_active) VALUES
('nzxt-h510',              'H510',                  'NZXT',         'case', 381, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":381,"max_cpu_cooler_height_mm":165,"drive_bays":2}',  2019, true),
('nzxt-h710',              'H710',                  'NZXT',         'case', 413, '{"form_factor":"ATX Full Tower","max_gpu_length_mm":413,"max_cpu_cooler_height_mm":185,"drive_bays":4}', 2019, true),
('fractal-meshify-c',      'Meshify C',             'Fractal',      'case', 315, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":315,"max_cpu_cooler_height_mm":172,"drive_bays":3}',  2017, true),
('fractal-define-7',       'Define 7',              'Fractal',      'case', 491, '{"form_factor":"ATX Full Tower","max_gpu_length_mm":491,"max_cpu_cooler_height_mm":185,"drive_bays":9}', 2020, true),
('lian-li-o11-dynamic',    'O11 Dynamic',           'Lian Li',      'case', 420, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":420,"max_cpu_cooler_height_mm":155,"drive_bays":2}',  2018, true),
('lian-li-lancool-216',    'LANCOOL 216',           'Lian Li',      'case', 400, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":400,"max_cpu_cooler_height_mm":176,"drive_bays":2}',  2022, true),
('corsair-4000d-airflow',  '4000D Airflow',         'Corsair',      'case', 360, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":360,"max_cpu_cooler_height_mm":170,"drive_bays":2}',  2020, true),
('corsair-5000d-airflow',  '5000D Airflow',         'Corsair',      'case', 420, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":420,"max_cpu_cooler_height_mm":170,"drive_bays":4}',  2021, true),
('be-quiet-pure-base-500dx','Pure Base 500DX',      'be quiet!',    'case', 369, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":369,"max_cpu_cooler_height_mm":190,"drive_bays":3}',  2020, true),
('phanteks-eclipse-p400a', 'Eclipse P400A',         'Phanteks',     'case', 420, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":420,"max_cpu_cooler_height_mm":160,"drive_bays":2}',  2020, true),
('coolermaster-masterbox-td500','MasterBox TD500',  'Cooler Master','case', 410, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":410,"max_cpu_cooler_height_mm":165,"drive_bays":2}',  2019, true),
('nzxt-h7-flow',           'H7 Flow',               'NZXT',         'case', 400, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":400,"max_cpu_cooler_height_mm":185,"drive_bays":2}',  2022, true),
('fractal-pop-air',        'Pop Air',               'Fractal',      'case', 460, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":460,"max_cpu_cooler_height_mm":185,"drive_bays":2}',  2022, true),
('lian-li-o11-air-mini',   'O11 Air Mini',          'Lian Li',      'case', 360, '{"form_factor":"mATX Mid Tower","max_gpu_length_mm":360,"max_cpu_cooler_height_mm":155,"drive_bays":2}', 2022, true),
('coolermaster-nr200p',    'NR200P',                'Cooler Master','case', 330, '{"form_factor":"Mini-ITX","max_gpu_length_mm":330,"max_cpu_cooler_height_mm":155,"drive_bays":2}',        2020, true)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Cooling (14)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, tdp, specs, release_year, is_active) VALUES
('noctua-nh-d15',              'NH-D15',                    'Noctua',       'cooling', 250, '{"type":"Air Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":250,"fan_size_mm":140,"noise_level_db":24.6}', 2014, true),
('noctua-nh-u12s',             'NH-U12S',                   'Noctua',       'cooling', 180, '{"type":"Air Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":180,"fan_size_mm":120,"noise_level_db":22.4}', 2013, true),
('be-quiet-dark-rock-pro-4',   'Dark Rock Pro 4',           'be quiet!',    'cooling', 250, '{"type":"Air Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":250,"fan_size_mm":135,"noise_level_db":24.3}', 2019, true),
('be-quiet-dark-rock-4',       'Dark Rock 4',               'be quiet!',    'cooling', 200, '{"type":"Air Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":200,"fan_size_mm":135,"noise_level_db":24.3}', 2018, true),
('coolermaster-hyper-212-evo', 'Hyper 212 EVO',             'Cooler Master','cooling', 150, '{"type":"Air Cooler","socket_compatibility":["AM4","LGA1700","LGA1200"],"tdp_rating":150,"fan_size_mm":120,"noise_level_db":36.0}',       2011, true),
('coolermaster-hyper-212-black','Hyper 212 Black Edition',  'Cooler Master','cooling', 150, '{"type":"Air Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":150,"fan_size_mm":120,"noise_level_db":30.0}', 2019, true),
('corsair-h100i-rgb-pro-xt',   'H100i RGB PRO XT',          'Corsair',      'cooling', 250, '{"type":"AIO Liquid Cooler","socket_compatibility":["AM4","LGA1700","LGA1200"],"tdp_rating":250,"fan_size_mm":120,"noise_level_db":37.0,"radiator_size_mm":240}', 2020, true),
('corsair-h150i-elite-capellix','H150i ELITE CAPELLIX',     'Corsair',      'cooling', 300, '{"type":"AIO Liquid Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":300,"fan_size_mm":120,"noise_level_db":37.0,"radiator_size_mm":360}', 2020, true),
('nzxt-kraken-x63',            'Kraken X63',                'NZXT',         'cooling', 280, '{"type":"AIO Liquid Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":280,"fan_size_mm":140,"noise_level_db":36.0,"radiator_size_mm":280}', 2020, true),
('nzxt-kraken-x53',            'Kraken X53',                'NZXT',         'cooling', 250, '{"type":"AIO Liquid Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":250,"fan_size_mm":120,"noise_level_db":36.0,"radiator_size_mm":240}', 2020, true),
('arctic-freezer-34-esports',  'Freezer 34 eSports',        'Arctic',       'cooling', 200, '{"type":"Air Cooler","socket_compatibility":["AM4","LGA1700","LGA1200"],"tdp_rating":200,"fan_size_mm":120,"noise_level_db":26.0}',       2019, true),
('arctic-liquid-freezer-ii-240','Liquid Freezer II 240',    'Arctic',       'cooling', 300, '{"type":"AIO Liquid Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":300,"fan_size_mm":120,"noise_level_db":37.5,"radiator_size_mm":240}', 2019, true),
('deepcool-ak620',             'AK620',                     'DeepCool',     'cooling', 260, '{"type":"Air Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":260,"fan_size_mm":120,"noise_level_db":28.0}', 2022, true),
('thermalright-peerless-assassin-120','Peerless Assassin 120','Thermalright','cooling',260, '{"type":"Air Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":260,"fan_size_mm":120,"noise_level_db":25.6}', 2022, true)
ON CONFLICT (slug) DO NOTHING;

