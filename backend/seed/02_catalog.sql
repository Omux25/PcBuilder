
-- Catalog v2 — Expanded component database
-- Adds missing GPUs, CPUs, RAM, storage, motherboards, PSUs, cases, and cooling
-- All entries follow the exact same format as seed_catalog.sql
-- Safe to run multiple times — uses ON CONFLICT (slug) DO NOTHING

-- ─────────────────────────────────────────────────────────────────────────────
-- GPUs — Missing models (RTX 5000 series, RTX 4090/4080, RX 9070, etc.)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, length_mm, tdp, specs, release_year, is_active) VALUES
('nvidia-rtx-5090',          'GeForce RTX 5090',          'NVIDIA', 'gpu', 360, 575, '{"chipset":"GB202","vram_gb":32,"length_mm":360,"tdp":575,"pcie_version":"5.0"}',  2025, true),
('nvidia-rtx-5080',          'GeForce RTX 5080',          'NVIDIA', 'gpu', 336, 360, '{"chipset":"GB203","vram_gb":16,"length_mm":336,"tdp":360,"pcie_version":"5.0"}',  2025, true),
('nvidia-rtx-5070-ti',       'GeForce RTX 5070 Ti',       'NVIDIA', 'gpu', 285, 300, '{"chipset":"GB203","vram_gb":16,"length_mm":285,"tdp":300,"pcie_version":"5.0"}',  2025, true),
('nvidia-rtx-5070',          'GeForce RTX 5070',          'NVIDIA', 'gpu', 244, 250, '{"chipset":"GB205","vram_gb":12,"length_mm":244,"tdp":250,"pcie_version":"5.0"}',  2025, true),
('nvidia-rtx-4090',          'GeForce RTX 4090',          'NVIDIA', 'gpu', 336, 450, '{"chipset":"AD102","vram_gb":24,"length_mm":336,"tdp":450,"pcie_version":"4.0"}',  2022, true),
('nvidia-rtx-4080-super',    'GeForce RTX 4080 SUPER',    'NVIDIA', 'gpu', 336, 320, '{"chipset":"AD103","vram_gb":16,"length_mm":336,"tdp":320,"pcie_version":"4.0"}',  2024, true),
('nvidia-rtx-4080',          'GeForce RTX 4080',          'NVIDIA', 'gpu', 336, 320, '{"chipset":"AD103","vram_gb":16,"length_mm":336,"tdp":320,"pcie_version":"4.0"}',  2022, true),
('nvidia-rtx-4070-ti-super', 'GeForce RTX 4070 Ti SUPER', 'NVIDIA', 'gpu', 285, 285, '{"chipset":"AD103","vram_gb":16,"length_mm":285,"tdp":285,"pcie_version":"4.0"}',  2024, true),
('nvidia-rtx-4070-ti',       'GeForce RTX 4070 Ti',       'NVIDIA', 'gpu', 285, 285, '{"chipset":"AD104","vram_gb":12,"length_mm":285,"tdp":285,"pcie_version":"4.0"}',  2023, true),
('nvidia-rtx-3090',          'GeForce RTX 3090',          'NVIDIA', 'gpu', 336, 350, '{"chipset":"GA102","vram_gb":24,"length_mm":336,"tdp":350,"pcie_version":"4.0"}',  2020, true),
('nvidia-rtx-3080-ti',       'GeForce RTX 3080 Ti',       'NVIDIA', 'gpu', 285, 350, '{"chipset":"GA102","vram_gb":12,"length_mm":285,"tdp":350,"pcie_version":"4.0"}',  2021, true),
('nvidia-rtx-3070-ti',       'GeForce RTX 3070 Ti',       'NVIDIA', 'gpu', 242, 290, '{"chipset":"GA104","vram_gb":8,"length_mm":242,"tdp":290,"pcie_version":"4.0"}',   2021, true),
('amd-rx-9070-xt',           'Radeon RX 9070 XT',         'AMD',    'gpu', 267, 304, '{"chipset":"Navi 48","vram_gb":16,"length_mm":267,"tdp":304,"pcie_version":"5.0"}', 2025, true),
('amd-rx-9070',              'Radeon RX 9070',             'AMD',    'gpu', 267, 220, '{"chipset":"Navi 48","vram_gb":16,"length_mm":267,"tdp":220,"pcie_version":"5.0"}', 2025, true),
('amd-rx-7900-gre',          'Radeon RX 7900 GRE',        'AMD',    'gpu', 267, 260, '{"chipset":"Navi 31","vram_gb":16,"length_mm":267,"tdp":260,"pcie_version":"4.0"}', 2023, true),
('amd-rx-6900-xt',           'Radeon RX 6900 XT',         'AMD',    'gpu', 267, 300, '{"chipset":"Navi 21","vram_gb":16,"length_mm":267,"tdp":300,"pcie_version":"4.0"}', 2020, true),
('amd-rx-6800',              'Radeon RX 6800',             'AMD',    'gpu', 267, 250, '{"chipset":"Navi 21","vram_gb":16,"length_mm":267,"tdp":250,"pcie_version":"4.0"}', 2020, true),
('nvidia-rtx-4060-ti-16gb',  'GeForce RTX 4060 Ti 16GB',  'NVIDIA', 'gpu', 240, 165, '{"chipset":"AD106","vram_gb":16,"length_mm":240,"tdp":165,"pcie_version":"4.0"}',  2023, true)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- CPUs — Missing variants (X3D, KF, newer gen, i3/i9)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, socket, tdp, specs, release_year, is_active) VALUES
('amd-ryzen-7-7800x3d',      'Ryzen 7 7800X3D',           'AMD',   'cpu', 'AM5',    120, '{"socket":"AM5","cores":8,"threads":16,"base_clock_ghz":4.2,"boost_clock_ghz":5.0,"tdp":120}',  2023, true),
('amd-ryzen-7-9800x3d',      'Ryzen 7 9800X3D',           'AMD',   'cpu', 'AM5',    120, '{"socket":"AM5","cores":8,"threads":16,"base_clock_ghz":4.7,"boost_clock_ghz":5.2,"tdp":120}',  2024, true),
('amd-ryzen-9-7950x3d',      'Ryzen 9 7950X3D',           'AMD',   'cpu', 'AM5',    120, '{"socket":"AM5","cores":16,"threads":32,"base_clock_ghz":4.2,"boost_clock_ghz":5.7,"tdp":120}', 2023, true),
('amd-ryzen-9-9950x',        'Ryzen 9 9950X',             'AMD',   'cpu', 'AM5',    170, '{"socket":"AM5","cores":16,"threads":32,"base_clock_ghz":4.3,"boost_clock_ghz":5.7,"tdp":170}', 2024, true),
('amd-ryzen-9-9900x',        'Ryzen 9 9900X',             'AMD',   'cpu', 'AM5',    120, '{"socket":"AM5","cores":12,"threads":24,"base_clock_ghz":4.4,"boost_clock_ghz":5.6,"tdp":120}', 2024, true),
('amd-ryzen-7-9700x',        'Ryzen 7 9700X',             'AMD',   'cpu', 'AM5',     65, '{"socket":"AM5","cores":8,"threads":16,"base_clock_ghz":3.8,"boost_clock_ghz":5.5,"tdp":65}',   2024, true),
('amd-ryzen-5-9600x',        'Ryzen 5 9600X',             'AMD',   'cpu', 'AM5',     65, '{"socket":"AM5","cores":6,"threads":12,"base_clock_ghz":3.9,"boost_clock_ghz":5.4,"tdp":65}',   2024, true),
('amd-ryzen-5-5600x',        'Ryzen 5 5600X',             'AMD',   'cpu', 'AM4',     65, '{"socket":"AM4","cores":6,"threads":12,"base_clock_ghz":3.7,"boost_clock_ghz":4.6,"tdp":65}',   2020, true),
('amd-ryzen-7-5800x',        'Ryzen 7 5800X',             'AMD',   'cpu', 'AM4',    105, '{"socket":"AM4","cores":8,"threads":16,"base_clock_ghz":3.8,"boost_clock_ghz":4.7,"tdp":105}',  2020, true),
('amd-ryzen-9-5900x',        'Ryzen 9 5900X',             'AMD',   'cpu', 'AM4',    105, '{"socket":"AM4","cores":12,"threads":24,"base_clock_ghz":3.7,"boost_clock_ghz":4.8,"tdp":105}', 2020, true),
('amd-ryzen-9-5950x',        'Ryzen 9 5950X',             'AMD',   'cpu', 'AM4',    105, '{"socket":"AM4","cores":16,"threads":32,"base_clock_ghz":3.4,"boost_clock_ghz":4.9,"tdp":105}', 2020, true),
('intel-core-i3-12100f',     'Core i3-12100F',            'Intel', 'cpu', 'LGA1700', 58, '{"socket":"LGA1700","cores":4,"threads":8,"base_clock_ghz":3.3,"boost_clock_ghz":4.3,"tdp":58}',  2022, true),
('intel-core-i5-12600kf',    'Core i5-12600KF',           'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":10,"threads":16,"base_clock_ghz":3.7,"boost_clock_ghz":4.9,"tdp":125}',2022, true),
('intel-core-i7-12700k',     'Core i7-12700K',            'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":12,"threads":20,"base_clock_ghz":3.6,"boost_clock_ghz":5.0,"tdp":125}',2021, true),
('intel-core-i9-12900k',     'Core i9-12900K',            'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":16,"threads":24,"base_clock_ghz":3.2,"boost_clock_ghz":5.2,"tdp":125}',2021, true),
('intel-core-i5-13600kf',    'Core i5-13600KF',           'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":14,"threads":20,"base_clock_ghz":3.5,"boost_clock_ghz":5.1,"tdp":125}',2022, true),
('intel-core-i7-13700kf',    'Core i7-13700KF',           'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":16,"threads":24,"base_clock_ghz":3.4,"boost_clock_ghz":5.4,"tdp":125}',2022, true),
('intel-core-i9-13900kf',    'Core i9-13900KF',           'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":24,"threads":32,"base_clock_ghz":3.0,"boost_clock_ghz":5.8,"tdp":125}',2022, true),
('intel-core-i5-14400f',     'Core i5-14400F',            'Intel', 'cpu', 'LGA1700', 65, '{"socket":"LGA1700","cores":10,"threads":16,"base_clock_ghz":2.5,"boost_clock_ghz":4.7,"tdp":65}', 2024, true),
('intel-core-i7-14700kf',    'Core i7-14700KF',           'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":20,"threads":28,"base_clock_ghz":3.4,"boost_clock_ghz":5.6,"tdp":125}',2023, true),
('intel-core-i9-14900kf',    'Core i9-14900KF',           'Intel', 'cpu', 'LGA1700',125, '{"socket":"LGA1700","cores":24,"threads":32,"base_clock_ghz":3.2,"boost_clock_ghz":6.0,"tdp":125}',2023, true),
('intel-core-ultra-5-245k',  'Core Ultra 5 245K',         'Intel', 'cpu', 'LGA1851',125, '{"socket":"LGA1851","cores":14,"threads":14,"base_clock_ghz":4.2,"boost_clock_ghz":5.2,"tdp":125}',2024, true),
('intel-core-ultra-7-265k',  'Core Ultra 7 265K',         'Intel', 'cpu', 'LGA1851',125, '{"socket":"LGA1851","cores":20,"threads":20,"base_clock_ghz":3.9,"boost_clock_ghz":5.5,"tdp":125}',2024, true),
('intel-core-ultra-9-285k',  'Core Ultra 9 285K',         'Intel', 'cpu', 'LGA1851',125, '{"socket":"LGA1851","cores":24,"threads":24,"base_clock_ghz":3.7,"boost_clock_ghz":5.7,"tdp":125}',2024, true)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- RAM — More kits (DDR4 and DDR5, various capacities and speeds)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, ram_type, frequency_mhz, specs, release_year, is_active) VALUES
('corsair-vengeance-ddr5-16gb-5600',      'Vengeance DDR5-5600 16GB',       'Corsair',  'ram', 'DDR5', 5600, '{"ram_type":"DDR5","capacity_gb":16,"frequency_mhz":5600,"cas_latency":36,"voltage":1.25,"kit":"2x8GB"}',  2022, true),
('corsair-vengeance-ddr5-96gb-5600',      'Vengeance DDR5-5600 96GB',       'Corsair',  'ram', 'DDR5', 5600, '{"ram_type":"DDR5","capacity_gb":96,"frequency_mhz":5600,"cas_latency":36,"voltage":1.25,"kit":"2x48GB"}', 2023, true),
('gskill-trident-z5-16gb-ddr5-6000',      'Trident Z5 16GB DDR5-6000',      'G.Skill',  'ram', 'DDR5', 6000, '{"ram_type":"DDR5","capacity_gb":16,"frequency_mhz":6000,"cas_latency":30,"voltage":1.35,"kit":"2x8GB"}',  2022, true),
('gskill-trident-z5-96gb-ddr5-6000',      'Trident Z5 96GB DDR5-6000',      'G.Skill',  'ram', 'DDR5', 6000, '{"ram_type":"DDR5","capacity_gb":96,"frequency_mhz":6000,"cas_latency":30,"voltage":1.35,"kit":"2x48GB"}', 2023, true),
('kingston-fury-beast-64gb-ddr5-5200',    'FURY Beast 64GB DDR5-5200',      'Kingston', 'ram', 'DDR5', 5200, '{"ram_type":"DDR5","capacity_gb":64,"frequency_mhz":5200,"cas_latency":40,"voltage":1.1,"kit":"2x32GB"}',  2022, true),
('kingston-fury-beast-16gb-ddr4-3600',    'FURY Beast 16GB DDR4-3600',      'Kingston', 'ram', 'DDR4', 3600, '{"ram_type":"DDR4","capacity_gb":16,"frequency_mhz":3600,"cas_latency":17,"voltage":1.35,"kit":"2x8GB"}',  2021, true),
('kingston-fury-beast-32gb-ddr4-3600',    'FURY Beast 32GB DDR4-3600',      'Kingston', 'ram', 'DDR4', 3600, '{"ram_type":"DDR4","capacity_gb":32,"frequency_mhz":3600,"cas_latency":17,"voltage":1.35,"kit":"2x16GB"}', 2021, true),
('corsair-vengeance-lpx-64gb-ddr4-3200',  'Vengeance LPX 64GB DDR4-3200',  'Corsair',  'ram', 'DDR4', 3200, '{"ram_type":"DDR4","capacity_gb":64,"frequency_mhz":3200,"cas_latency":16,"voltage":1.35,"kit":"2x32GB"}', 2019, true),
('gskill-ripjaws-v-64gb-ddr4-3600',       'Ripjaws V 64GB DDR4-3600',       'G.Skill',  'ram', 'DDR4', 3600, '{"ram_type":"DDR4","capacity_gb":64,"frequency_mhz":3600,"cas_latency":16,"voltage":1.35,"kit":"2x32GB"}', 2019, true),
('teamgroup-t-force-delta-16gb-ddr5-6000','T-Force Delta 16GB DDR5-6000',   'TeamGroup','ram', 'DDR5', 6000, '{"ram_type":"DDR5","capacity_gb":16,"frequency_mhz":6000,"cas_latency":38,"voltage":1.35,"kit":"2x8GB"}',  2022, true),
('teamgroup-t-force-delta-64gb-ddr5-6000','T-Force Delta 64GB DDR5-6000',   'TeamGroup','ram', 'DDR5', 6000, '{"ram_type":"DDR5","capacity_gb":64,"frequency_mhz":6000,"cas_latency":38,"voltage":1.35,"kit":"2x32GB"}', 2022, true),
('lexar-ares-32gb-ddr5-6000',             'Ares 32GB DDR5-6000',            'Lexar',    'ram', 'DDR5', 6000, '{"ram_type":"DDR5","capacity_gb":32,"frequency_mhz":6000,"cas_latency":30,"voltage":1.35,"kit":"2x16GB"}', 2023, true),
('lexar-ares-64gb-ddr5-6000',             'Ares 64GB DDR5-6000',            'Lexar',    'ram', 'DDR5', 6000, '{"ram_type":"DDR5","capacity_gb":64,"frequency_mhz":6000,"cas_latency":30,"voltage":1.35,"kit":"2x32GB"}', 2023, true),
('crucial-pro-32gb-ddr5-5600',            'Pro 32GB DDR5-5600',             'Crucial',  'ram', 'DDR5', 5600, '{"ram_type":"DDR5","capacity_gb":32,"frequency_mhz":5600,"cas_latency":46,"voltage":1.1,"kit":"2x16GB"}',  2022, true),
('crucial-pro-64gb-ddr5-5600',            'Pro 64GB DDR5-5600',             'Crucial',  'ram', 'DDR5', 5600, '{"ram_type":"DDR5","capacity_gb":64,"frequency_mhz":5600,"cas_latency":46,"voltage":1.1,"kit":"2x32GB"}',  2022, true)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Storage — More NVMe SSDs (PCIe 5.0, larger capacities)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('samsung-990-pro-2tb',           '990 PRO 2TB',           'Samsung',  'storage', '{"type":"NVMe SSD","capacity_gb":2000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7450,"write_speed_mbps":6900}', 2022, true),
('samsung-990-pro-4tb',           '990 PRO 4TB',           'Samsung',  'storage', '{"type":"NVMe SSD","capacity_gb":4000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7450,"write_speed_mbps":6900}', 2024, true),
('wd-black-sn850x-2tb',           'WD_BLACK SN850X 2TB',   'WD',       'storage', '{"type":"NVMe SSD","capacity_gb":2000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7300,"write_speed_mbps":6600}', 2022, true),
('wd-black-sn850x-4tb',           'WD_BLACK SN850X 4TB',   'WD',       'storage', '{"type":"NVMe SSD","capacity_gb":4000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7300,"write_speed_mbps":6600}', 2023, true),
('seagate-firecuda-530-1tb',      'FireCuda 530 1TB',      'Seagate',  'storage', '{"type":"NVMe SSD","capacity_gb":1000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7300,"write_speed_mbps":6900}', 2021, true),
('seagate-firecuda-530-2tb',      'FireCuda 530 2TB',      'Seagate',  'storage', '{"type":"NVMe SSD","capacity_gb":2000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7300,"write_speed_mbps":6900}', 2021, true),
('corsair-mp600-pro-1tb',         'MP600 PRO 1TB',         'Corsair',  'storage', '{"type":"NVMe SSD","capacity_gb":1000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7100,"write_speed_mbps":6800}', 2021, true),
('corsair-mp600-pro-2tb',         'MP600 PRO 2TB',         'Corsair',  'storage', '{"type":"NVMe SSD","capacity_gb":2000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7100,"write_speed_mbps":6800}', 2021, true),
('kingston-nv2-500gb',            'NV2 500GB NVMe',        'Kingston', 'storage', '{"type":"NVMe SSD","capacity_gb":500,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":3500,"write_speed_mbps":1300}',  2022, true),
('kingston-nv2-4tb',              'NV2 4TB NVMe',          'Kingston', 'storage', '{"type":"NVMe SSD","capacity_gb":4000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":3500,"write_speed_mbps":2800}', 2023, true),
('crucial-p3-2tb-nvme',           'P3 2TB NVMe',           'Crucial',  'storage', '{"type":"NVMe SSD","capacity_gb":2000,"interface":"M.2 PCIe 3.0 x4","read_speed_mbps":3500,"write_speed_mbps":3000}', 2022, true),
('crucial-p3-4tb-nvme',           'P3 4TB NVMe',           'Crucial',  'storage', '{"type":"NVMe SSD","capacity_gb":4000,"interface":"M.2 PCIe 3.0 x4","read_speed_mbps":3500,"write_speed_mbps":3000}', 2023, true),
('seagate-barracuda-1tb-hdd',     'BarraCuda 1TB HDD',     'Seagate',  'storage', '{"type":"HDD","capacity_gb":1000,"interface":"SATA 6Gb/s","read_speed_mbps":190,"write_speed_mbps":190}',             2020, true),
('seagate-barracuda-8tb-hdd',     'BarraCuda 8TB HDD',     'Seagate',  'storage', '{"type":"HDD","capacity_gb":8000,"interface":"SATA 6Gb/s","read_speed_mbps":190,"write_speed_mbps":190}',             2020, true),
('wd-blue-2tb-sata-ssd',          'WD Blue 2TB SATA SSD',  'WD',       'storage', '{"type":"SATA SSD","capacity_gb":2000,"interface":"SATA 6Gb/s","read_speed_mbps":560,"write_speed_mbps":530}',        2021, true),
('samsung-870-evo-2tb-sata',      '870 EVO 2TB SATA SSD',  'Samsung',  'storage', '{"type":"SATA SSD","capacity_gb":2000,"interface":"SATA 6Gb/s","read_speed_mbps":560,"write_speed_mbps":530}',        2021, true),
('samsung-870-evo-500gb-sata',    '870 EVO 500GB SATA SSD','Samsung',  'storage', '{"type":"SATA SSD","capacity_gb":500,"interface":"SATA 6Gb/s","read_speed_mbps":560,"write_speed_mbps":530}',         2021, true),
('lexar-nm790-1tb',               'NM790 1TB NVMe',        'Lexar',    'storage', '{"type":"NVMe SSD","capacity_gb":1000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7400,"write_speed_mbps":6500}', 2023, true),
('lexar-nm790-2tb',               'NM790 2TB NVMe',        'Lexar',    'storage', '{"type":"NVMe SSD","capacity_gb":2000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7400,"write_speed_mbps":6500}', 2023, true),
('lexar-nm790-4tb',               'NM790 4TB NVMe',        'Lexar',    'storage', '{"type":"NVMe SSD","capacity_gb":4000,"interface":"M.2 PCIe 4.0 x4","read_speed_mbps":7400,"write_speed_mbps":6500}', 2023, true)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Motherboards — More models (Z690, X570, B450, LGA1851)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, socket, supported_ram_types, max_ram_frequency, specs, release_year, is_active) VALUES
('msi-b450-gaming-plus-max',         'B450 GAMING PLUS MAX',         'MSI',      'motherboard', 'AM4',    ARRAY['DDR4'], 4400, '{"socket":"AM4","chipset":"B450","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":4400}',   2019, true),
('asus-prime-b450-plus',             'PRIME B450-PLUS',              'ASUS',     'motherboard', 'AM4',    ARRAY['DDR4'], 4400, '{"socket":"AM4","chipset":"B450","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":4400}',   2018, true),
('gigabyte-b450-aorus-elite',        'B450 AORUS ELITE',             'Gigabyte', 'motherboard', 'AM4',    ARRAY['DDR4'], 4400, '{"socket":"AM4","chipset":"B450","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":4400}',   2018, true),
('asus-rog-strix-x570-e',            'ROG STRIX X570-E GAMING',      'ASUS',     'motherboard', 'AM4',    ARRAY['DDR4'], 5100, '{"socket":"AM4","chipset":"X570","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":5100}',   2019, true),
('msi-meg-x570-ace',                 'MEG X570 ACE',                 'MSI',      'motherboard', 'AM4',    ARRAY['DDR4'], 5100, '{"socket":"AM4","chipset":"X570","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":5100}',   2019, true),
('gigabyte-x570-aorus-master',       'X570 AORUS MASTER',            'Gigabyte', 'motherboard', 'AM4',    ARRAY['DDR4'], 5100, '{"socket":"AM4","chipset":"X570","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":5100}',   2019, true),
('asrock-x570-phantom-gaming-4',     'X570 Phantom Gaming 4',        'ASRock',   'motherboard', 'AM4',    ARRAY['DDR4'], 4666, '{"socket":"AM4","chipset":"X570","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":4666}',   2019, true),
('msi-pro-z690-a-wifi',              'PRO Z690-A WIFI',              'MSI',      'motherboard', 'LGA1700',ARRAY['DDR4','DDR5'], 6400, '{"socket":"LGA1700","chipset":"Z690","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4","DDR5"],"max_ram_frequency":6400}', 2021, true),
('asus-prime-z690-p',                'PRIME Z690-P',                 'ASUS',     'motherboard', 'LGA1700',ARRAY['DDR4','DDR5'], 6400, '{"socket":"LGA1700","chipset":"Z690","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4","DDR5"],"max_ram_frequency":6400}', 2021, true),
('gigabyte-z690-aorus-elite-ax',     'Z690 AORUS ELITE AX',          'Gigabyte', 'motherboard', 'LGA1700',ARRAY['DDR5'], 6400, '{"socket":"LGA1700","chipset":"Z690","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":6400}', 2021, true),
('msi-mag-z790-tomahawk-ddr4',       'MAG Z790 TOMAHAWK WIFI DDR4',  'MSI',      'motherboard', 'LGA1700',ARRAY['DDR4'], 5333, '{"socket":"LGA1700","chipset":"Z790","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":5333}', 2022, true),
('asus-prime-z790-p-ddr4',           'PRIME Z790-P DDR4',            'ASUS',     'motherboard', 'LGA1700',ARRAY['DDR4'], 5333, '{"socket":"LGA1700","chipset":"Z790","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":5333}', 2022, true),
('msi-pro-z890-a-wifi',              'PRO Z890-A WIFI',              'MSI',      'motherboard', 'LGA1851',ARRAY['DDR5'], 9200, '{"socket":"LGA1851","chipset":"Z890","form_factor":"ATX","ram_slots":4,"max_ram_gb":256,"supported_ram_types":["DDR5"],"max_ram_frequency":9200}', 2024, true),
('asus-prime-z890-p',                'PRIME Z890-P',                 'ASUS',     'motherboard', 'LGA1851',ARRAY['DDR5'], 8000, '{"socket":"LGA1851","chipset":"Z890","form_factor":"ATX","ram_slots":4,"max_ram_gb":256,"supported_ram_types":["DDR5"],"max_ram_frequency":8000}', 2024, true),
('gigabyte-z890-aorus-elite-x',      'Z890 AORUS ELITE X',           'Gigabyte', 'motherboard', 'LGA1851',ARRAY['DDR5'], 9200, '{"socket":"LGA1851","chipset":"Z890","form_factor":"ATX","ram_slots":4,"max_ram_gb":256,"supported_ram_types":["DDR5"],"max_ram_frequency":9200}', 2024, true),
('asrock-b650e-pg-riptide-wifi',     'B650E PG Riptide WiFi',        'ASRock',   'motherboard', 'AM5',    ARRAY['DDR5'], 6400, '{"socket":"AM5","chipset":"B650E","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":6400}',   2022, true),
('msi-mag-b650-tomahawk-wifi',       'MAG B650 TOMAHAWK WIFI',       'MSI',      'motherboard', 'AM5',    ARRAY['DDR5'], 6000, '{"socket":"AM5","chipset":"B650","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":6000}',   2022, true),
('asus-tuf-gaming-b650-plus-wifi',   'TUF GAMING B650-PLUS WIFI',    'ASUS',     'motherboard', 'AM5',    ARRAY['DDR5'], 6400, '{"socket":"AM5","chipset":"B650","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":6400}',   2022, true),
('gigabyte-b650m-ds3h',              'B650M DS3H',                   'Gigabyte', 'motherboard', 'AM5',    ARRAY['DDR5'], 6400, '{"socket":"AM5","chipset":"B650","form_factor":"mATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":6400}',  2022, true),
('msi-b760m-gaming-plus-wifi',       'B760M GAMING PLUS WIFI',       'MSI',      'motherboard', 'LGA1700',ARRAY['DDR4','DDR5'], 5600, '{"socket":"LGA1700","chipset":"B760","form_factor":"mATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4","DDR5"],"max_ram_frequency":5600}', 2023, true)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- PSUs — More wattage options and brands
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, wattage, specs, release_year, is_active) VALUES
('corsair-rm1200x',              'RM1200x 1200W',             'Corsair',  'psu', 1200, '{"wattage":1200,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',   2021, true),
('corsair-hx1000',               'HX1000 1000W',              'Corsair',  'psu', 1000, '{"wattage":1000,"efficiency_rating":"80+ Platinum","modular":"Fully modular","form_factor":"ATX"}', 2020, true),
('corsair-hx850',                'HX850 850W',                'Corsair',  'psu', 850,  '{"wattage":850,"efficiency_rating":"80+ Platinum","modular":"Fully modular","form_factor":"ATX"}',  2020, true),
('be-quiet-pure-power-12-750w',  'Pure Power 12 750W',        'be quiet!','psu', 750,  '{"wattage":750,"efficiency_rating":"80+ Gold","modular":"Semi-modular","form_factor":"ATX"}',       2023, true),
('be-quiet-pure-power-12-850w',  'Pure Power 12 850W',        'be quiet!','psu', 850,  '{"wattage":850,"efficiency_rating":"80+ Gold","modular":"Semi-modular","form_factor":"ATX"}',       2023, true),
('be-quiet-straight-power-12-1000w','Straight Power 12 1000W','be quiet!','psu', 1000, '{"wattage":1000,"efficiency_rating":"80+ Platinum","modular":"Fully modular","form_factor":"ATX"}', 2023, true),
('seasonic-focus-gx-1000',       'Focus GX-1000 1000W',       'Seasonic', 'psu', 1000, '{"wattage":1000,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',    2021, true),
('seasonic-prime-tx-1000',       'PRIME TX-1000 1000W',       'Seasonic', 'psu', 1000, '{"wattage":1000,"efficiency_rating":"80+ Titanium","modular":"Fully modular","form_factor":"ATX"}', 2020, true),
('seasonic-prime-tx-1300',       'PRIME TX-1300 1300W',       'Seasonic', 'psu', 1300, '{"wattage":1300,"efficiency_rating":"80+ Titanium","modular":"Fully modular","form_factor":"ATX"}', 2022, true),
('msi-mag-a850gl',               'MAG A850GL 850W',           'MSI',      'psu', 850,  '{"wattage":850,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',      2022, true),
('msi-mag-a1000gl',              'MAG A1000GL 1000W',         'MSI',      'psu', 1000, '{"wattage":1000,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',     2022, true),
('asus-rog-strix-1000g',         'ROG STRIX 1000G',           'ASUS',     'psu', 1000, '{"wattage":1000,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',     2021, true),
('asus-rog-thor-1200p2',         'ROG THOR 1200P2',           'ASUS',     'psu', 1200, '{"wattage":1200,"efficiency_rating":"80+ Platinum","modular":"Fully modular","form_factor":"ATX"}', 2022, true),
('deepcool-pq850m',              'PQ850M 850W',               'DeepCool', 'psu', 850,  '{"wattage":850,"efficiency_rating":"80+ Gold","modular":"Semi-modular","form_factor":"ATX"}',       2022, true),
('deepcool-pq1000m',             'PQ1000M 1000W',             'DeepCool', 'psu', 1000, '{"wattage":1000,"efficiency_rating":"80+ Gold","modular":"Semi-modular","form_factor":"ATX"}',      2022, true),
('thermaltake-toughpower-gf3-850w','Toughpower GF3 850W',     'Thermaltake','psu',850, '{"wattage":850,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',      2022, true),
('thermaltake-toughpower-gf3-1000w','Toughpower GF3 1000W',   'Thermaltake','psu',1000,'{"wattage":1000,"efficiency_rating":"80+ Gold","modular":"Fully modular","form_factor":"ATX"}',     2022, true)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Cases — More models
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, max_gpu_length_mm, specs, release_year, is_active) VALUES
('lian-li-o11-dynamic-evo',    'O11 Dynamic EVO',           'Lian Li',      'case', 420, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":420,"max_cpu_cooler_height_mm":167,"drive_bays":2}',  2022, true),
('lian-li-o11-air',            'O11 Air',                   'Lian Li',      'case', 420, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":420,"max_cpu_cooler_height_mm":155,"drive_bays":2}',  2021, true),
('nzxt-h9-flow',               'H9 Flow',                   'NZXT',         'case', 435, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":435,"max_cpu_cooler_height_mm":185,"drive_bays":2}',  2022, true),
('nzxt-h6-flow',               'H6 Flow',                   'NZXT',         'case', 365, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":365,"max_cpu_cooler_height_mm":185,"drive_bays":2}',  2023, true),
('fractal-torrent',            'Torrent',                   'Fractal',      'case', 461, '{"form_factor":"ATX Full Tower","max_gpu_length_mm":461,"max_cpu_cooler_height_mm":188,"drive_bays":4}',  2021, true),
('fractal-north',              'North',                     'Fractal',      'case', 355, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":355,"max_cpu_cooler_height_mm":185,"drive_bays":2}',  2022, true),
('corsair-7000d-airflow',      '7000D Airflow',             'Corsair',      'case', 420, '{"form_factor":"ATX Full Tower","max_gpu_length_mm":420,"max_cpu_cooler_height_mm":190,"drive_bays":6}',  2021, true),
('be-quiet-silent-base-802',   'Silent Base 802',           'be quiet!',    'case', 369, '{"form_factor":"ATX Full Tower","max_gpu_length_mm":369,"max_cpu_cooler_height_mm":185,"drive_bays":8}',  2021, true),
('deepcool-ch510',             'CH510',                     'DeepCool',     'case', 380, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":380,"max_cpu_cooler_height_mm":175,"drive_bays":2}',  2021, true),
('deepcool-matrexx-55',        'MATREXX 55',                'DeepCool',     'case', 370, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":370,"max_cpu_cooler_height_mm":165,"drive_bays":2}',  2019, true),
('xtrmlab-xt-1',               'XT-1',                      'XTRMLAB',      'case', 380, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":380,"max_cpu_cooler_height_mm":165,"drive_bays":2}',  2022, true),
('xtrmlab-xt-2',               'XT-2',                      'XTRMLAB',      'case', 400, '{"form_factor":"ATX Mid Tower","max_gpu_length_mm":400,"max_cpu_cooler_height_mm":170,"drive_bays":2}',  2022, true)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- Cooling — More air coolers and AIOs
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, tdp, specs, release_year, is_active) VALUES
('noctua-nh-d15s',             'NH-D15S',                   'Noctua',       'cooling', 250, '{"type":"Air Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":250,"fan_size_mm":140,"noise_level_db":24.6}', 2015, true),
('noctua-nh-u14s',             'NH-U14S',                   'Noctua',       'cooling', 200, '{"type":"Air Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":200,"fan_size_mm":140,"noise_level_db":23.6}', 2014, true),
('be-quiet-dark-rock-slim',    'Dark Rock Slim',            'be quiet!',    'cooling', 180, '{"type":"Air Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":180,"fan_size_mm":120,"noise_level_db":23.3}', 2019, true),
('deepcool-ak400',             'AK400',                     'DeepCool',     'cooling', 220, '{"type":"Air Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":220,"fan_size_mm":120,"noise_level_db":28.0}', 2022, true),
('deepcool-ak500',             'AK500',                     'DeepCool',     'cooling', 240, '{"type":"Air Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":240,"fan_size_mm":120,"noise_level_db":27.3}', 2022, true),
('thermalright-assassin-x-120-r-se','Assassin X 120 R SE', 'Thermalright', 'cooling', 200, '{"type":"Air Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":200,"fan_size_mm":120,"noise_level_db":25.6}', 2023, true),
('arctic-freezer-36',          'Freezer 36',                'Arctic',       'cooling', 220, '{"type":"Air Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":220,"fan_size_mm":120,"noise_level_db":26.0}', 2023, true),
('corsair-h100i-elite-lcd',    'H100i ELITE LCD',           'Corsair',      'cooling', 300, '{"type":"AIO Liquid Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":300,"fan_size_mm":120,"noise_level_db":37.0,"radiator_size_mm":240}', 2022, true),
('corsair-h150i-elite-lcd',    'H150i ELITE LCD',           'Corsair',      'cooling', 350, '{"type":"AIO Liquid Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":350,"fan_size_mm":120,"noise_level_db":37.0,"radiator_size_mm":360}', 2022, true),
('nzxt-kraken-240',            'Kraken 240',                'NZXT',         'cooling', 250, '{"type":"AIO Liquid Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":250,"fan_size_mm":120,"noise_level_db":36.0,"radiator_size_mm":240}', 2022, true),
('nzxt-kraken-360',            'Kraken 360',                'NZXT',         'cooling', 350, '{"type":"AIO Liquid Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":350,"fan_size_mm":120,"noise_level_db":36.0,"radiator_size_mm":360}', 2022, true),
('deepcool-lt520',             'LT520',                     'DeepCool',     'cooling', 280, '{"type":"AIO Liquid Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":280,"fan_size_mm":120,"noise_level_db":32.9,"radiator_size_mm":240}', 2022, true),
('deepcool-lt720',             'LT720',                     'DeepCool',     'cooling', 350, '{"type":"AIO Liquid Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":350,"fan_size_mm":120,"noise_level_db":32.9,"radiator_size_mm":360}', 2022, true),
('arctic-liquid-freezer-ii-360','Liquid Freezer II 360',    'Arctic',       'cooling', 350, '{"type":"AIO Liquid Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":350,"fan_size_mm":120,"noise_level_db":37.5,"radiator_size_mm":360}', 2020, true),
('be-quiet-pure-loop-2-360',   'Pure Loop 2 360',           'be quiet!',    'cooling', 300, '{"type":"AIO Liquid Cooler","socket_compatibility":["AM4","AM5","LGA1700","LGA1200"],"tdp_rating":300,"fan_size_mm":120,"noise_level_db":34.9,"radiator_size_mm":360}', 2023, true)
ON CONFLICT (slug) DO NOTHING;

