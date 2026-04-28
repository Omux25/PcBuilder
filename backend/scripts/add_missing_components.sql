-- Missing components found by audit_all_scrapers.ts
-- Run: PGPASSWORD=pc_builder_pass_2024 psql -h 127.0.0.1 -p 5433 -U pc_builder_user -d pc_builder -f backend/scripts/add_missing_components.sql

-- ── GPUs: RTX 5000 series (Blackwell, 2025) ──────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('nvidia-geforce-rtx-5060-ti', 'GeForce RTX 5060 Ti', 'NVIDIA', 'gpu', '{"chipset":"RTX 5060 Ti","vram_gb":16,"tdp":180,"pcie_version":"5.0"}', 2025, true),
('nvidia-geforce-rtx-5060',    'GeForce RTX 5060',    'NVIDIA', 'gpu', '{"chipset":"RTX 5060","vram_gb":8,"tdp":150,"pcie_version":"5.0"}',    2025, true),
('nvidia-geforce-rtx-5050',    'GeForce RTX 5050',    'NVIDIA', 'gpu', '{"chipset":"RTX 5050","vram_gb":8,"tdp":130,"pcie_version":"5.0"}',    2025, true)
ON CONFLICT (slug) DO NOTHING;

-- ── GPUs: AMD RX 9000 series (RDNA 4, 2025) ──────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('amd-radeon-rx-9060-xt', 'Radeon RX 9060 XT', 'AMD', 'gpu', '{"chipset":"RX 9060 XT","vram_gb":16,"tdp":150,"pcie_version":"5.0"}', 2025, true)
ON CONFLICT (slug) DO NOTHING;

-- ── GPUs: Intel Arc B-series (Battlemage, 2024) ───────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('intel-arc-b580', 'Arc B580', 'Intel', 'gpu', '{"chipset":"Arc B580","vram_gb":12,"tdp":190,"pcie_version":"4.0"}', 2024, true),
('intel-arc-b570', 'Arc B570', 'Intel', 'gpu', '{"chipset":"Arc B570","vram_gb":10,"tdp":150,"pcie_version":"4.0"}', 2024, true)
ON CONFLICT (slug) DO NOTHING;

-- ── GPUs: older budget cards still sold ──────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('nvidia-geforce-gtx-1650', 'GeForce GTX 1650', 'NVIDIA', 'gpu', '{"chipset":"GTX 1650","vram_gb":4,"tdp":75,"pcie_version":"3.0"}',  2019, true),
('nvidia-geforce-gtx-1660', 'GeForce GTX 1660', 'NVIDIA', 'gpu', '{"chipset":"GTX 1660","vram_gb":6,"tdp":120,"pcie_version":"3.0"}', 2019, true),
('nvidia-geforce-gtx-1660-super', 'GeForce GTX 1660 Super', 'NVIDIA', 'gpu', '{"chipset":"GTX 1660 Super","vram_gb":6,"tdp":125,"pcie_version":"3.0"}', 2019, true),
('nvidia-geforce-gtx-1660-ti',    'GeForce GTX 1660 Ti',    'NVIDIA', 'gpu', '{"chipset":"GTX 1660 Ti","vram_gb":6,"tdp":120,"pcie_version":"3.0"}',   2019, true),
('nvidia-geforce-rtx-2060-super', 'GeForce RTX 2060 Super', 'NVIDIA', 'gpu', '{"chipset":"RTX 2060 Super","vram_gb":8,"tdp":175,"pcie_version":"3.0"}', 2019, true),
('nvidia-geforce-rtx-2070',       'GeForce RTX 2070',       'NVIDIA', 'gpu', '{"chipset":"RTX 2070","vram_gb":8,"tdp":175,"pcie_version":"3.0"}',       2018, true),
('amd-radeon-rx-6400',   'Radeon RX 6400',   'AMD', 'gpu', '{"chipset":"RX 6400","vram_gb":4,"tdp":53,"pcie_version":"4.0"}',   2022, true),
('amd-radeon-rx-6650-xt','Radeon RX 6650 XT','AMD', 'gpu', '{"chipset":"RX 6650 XT","vram_gb":8,"tdp":180,"pcie_version":"4.0"}',2022, true),
('amd-radeon-rx-6700',   'Radeon RX 6700',   'AMD', 'gpu', '{"chipset":"RX 6700","vram_gb":10,"tdp":175,"pcie_version":"4.0"}', 2022, true),
('amd-radeon-rx-6950-xt','Radeon RX 6950 XT','AMD', 'gpu', '{"chipset":"RX 6950 XT","vram_gb":16,"tdp":335,"pcie_version":"4.0"}',2022, true),
('amd-radeon-rx-5500-xt','Radeon RX 5500 XT','AMD', 'gpu', '{"chipset":"RX 5500 XT","vram_gb":8,"tdp":130,"pcie_version":"4.0"}', 2019, true),
('amd-radeon-rx-5700-xt','Radeon RX 5700 XT','AMD', 'gpu', '{"chipset":"RX 5700 XT","vram_gb":8,"tdp":225,"pcie_version":"4.0"}', 2019, true)
ON CONFLICT (slug) DO NOTHING;

-- ── Motherboards: AM5 new chipsets (X870, B850, B860, B840) ──────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('generic-x870e-am5',  'X870E (generic)',  'Generic', 'motherboard', '{"socket":"AM5","chipset":"X870E","form_factor":"ATX","ram_slots":4,"max_ram_gb":256,"supported_ram_types":["DDR5"],"max_ram_frequency":8000}', 2024, true),
('generic-x870-am5',   'X870 (generic)',   'Generic', 'motherboard', '{"socket":"AM5","chipset":"X870","form_factor":"ATX","ram_slots":4,"max_ram_gb":256,"supported_ram_types":["DDR5"],"max_ram_frequency":8000}',  2024, true),
('generic-b850-am5',   'B850 (generic)',   'Generic', 'motherboard', '{"socket":"AM5","chipset":"B850","form_factor":"ATX","ram_slots":4,"max_ram_gb":256,"supported_ram_types":["DDR5"],"max_ram_frequency":8000}',  2024, true),
('generic-b860-lga1851','B860 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1851","chipset":"B860","form_factor":"ATX","ram_slots":4,"max_ram_gb":192,"supported_ram_types":["DDR5"],"max_ram_frequency":6400}',2024, true),
('generic-b840-lga1851','B840 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1851","chipset":"B840","form_factor":"ATX","ram_slots":4,"max_ram_gb":192,"supported_ram_types":["DDR5"],"max_ram_frequency":6400}',2024, true)
ON CONFLICT (slug) DO NOTHING;

-- ── Motherboards: older chipsets still sold (A520, B550, X570, Z490, Z590, B560, H670) ──
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('generic-a520-am4',   'A520 (generic)',   'Generic', 'motherboard', '{"socket":"AM4","chipset":"A520","form_factor":"mATX","ram_slots":2,"max_ram_gb":64,"supported_ram_types":["DDR4"],"max_ram_frequency":4866}',  2020, true),
('generic-a620-am5',   'A620 (generic)',   'Generic', 'motherboard', '{"socket":"AM5","chipset":"A620","form_factor":"mATX","ram_slots":2,"max_ram_gb":64,"supported_ram_types":["DDR5"],"max_ram_frequency":6400}',   2023, true),
('generic-b550-am4',   'B550 (generic)',   'Generic', 'motherboard', '{"socket":"AM4","chipset":"B550","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":5100}',   2020, true),
('generic-x570-am4',   'X570 (generic)',   'Generic', 'motherboard', '{"socket":"AM4","chipset":"X570","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":5100}',   2019, true),
('generic-b450-am4',   'B450 (generic)',   'Generic', 'motherboard', '{"socket":"AM4","chipset":"B450","form_factor":"ATX","ram_slots":4,"max_ram_gb":64,"supported_ram_types":["DDR4"],"max_ram_frequency":3533}',    2018, true),
('generic-a320-am4',   'A320 (generic)',   'Generic', 'motherboard', '{"socket":"AM4","chipset":"A320","form_factor":"mATX","ram_slots":2,"max_ram_gb":32,"supported_ram_types":["DDR4"],"max_ram_frequency":3200}',   2017, true),
('generic-b365-lga1151','B365 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1151","chipset":"B365","form_factor":"ATX","ram_slots":4,"max_ram_gb":64,"supported_ram_types":["DDR4"],"max_ram_frequency":2666}', 2018, true),
('generic-b460-lga1200','B460 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1200","chipset":"B460","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":2933}',2020, true),
('generic-b560-lga1200','B560 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1200","chipset":"B560","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":4800}',2021, true),
('generic-h670-lga1700','H670 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1700","chipset":"H670","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4","DDR5"],"max_ram_frequency":4800}',2022, true),
('generic-z490-lga1200','Z490 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1200","chipset":"Z490","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":4800}',2020, true),
('generic-z590-lga1200','Z590 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1200","chipset":"Z590","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":5333}',2021, true),
('generic-h310-lga1151','H310 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1151","chipset":"H310","form_factor":"mATX","ram_slots":2,"max_ram_gb":32,"supported_ram_types":["DDR4"],"max_ram_frequency":2666}',2018, true),
('generic-h410-lga1200','H410 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1200","chipset":"H410","form_factor":"mATX","ram_slots":2,"max_ram_gb":64,"supported_ram_types":["DDR4"],"max_ram_frequency":2933}', 2020, true),
('generic-h510-lga1200','H510 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1200","chipset":"H510","form_factor":"mATX","ram_slots":2,"max_ram_gb":64,"supported_ram_types":["DDR4"],"max_ram_frequency":4800}', 2021, true),
('generic-h610-lga1700','H610 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1700","chipset":"H610","form_factor":"mATX","ram_slots":2,"max_ram_gb":64,"supported_ram_types":["DDR4","DDR5"],"max_ram_frequency":4800}',2022, true),
('generic-h810-lga1851','H810 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1851","chipset":"H810","form_factor":"mATX","ram_slots":2,"max_ram_gb":64,"supported_ram_types":["DDR5"],"max_ram_frequency":5600}', 2024, true),
('generic-z390-lga1151','Z390 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1151","chipset":"Z390","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4"],"max_ram_frequency":4266}', 2018, true),
('generic-z690-lga1700','Z690 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1700","chipset":"Z690","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4","DDR5"],"max_ram_frequency":6400}',2021, true),
('generic-b660-lga1700','B660 (generic)',  'Generic', 'motherboard', '{"socket":"LGA1700","chipset":"B660","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR4","DDR5"],"max_ram_frequency":4800}',2022, true),
('generic-trx40-strx4', 'TRX40 (generic)', 'Generic', 'motherboard', '{"socket":"sTRX4","chipset":"TRX40","form_factor":"E-ATX","ram_slots":8,"max_ram_gb":256,"supported_ram_types":["DDR4"],"max_ram_frequency":3200}', 2019, true)
ON CONFLICT (slug) DO NOTHING;

-- ── PSUs: missing wattage/model entries ───────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('generic-psu-500w',  '500W PSU (generic)',  'Generic', 'psu', '{"wattage":500,"efficiency_rating":"80+","modular":false,"form_factor":"ATX"}',  2020, true),
('generic-psu-600w',  '600W PSU (generic)',  'Generic', 'psu', '{"wattage":600,"efficiency_rating":"80+","modular":false,"form_factor":"ATX"}',  2020, true),
('generic-psu-700w',  '700W PSU (generic)',  'Generic', 'psu', '{"wattage":700,"efficiency_rating":"80+","modular":false,"form_factor":"ATX"}',  2020, true),
('generic-psu-1050w', '1050W PSU (generic)', 'Generic', 'psu', '{"wattage":1050,"efficiency_rating":"gold","modular":true,"form_factor":"ATX"}', 2022, true),
('generic-psu-1250w', '1250W PSU (generic)', 'Generic', 'psu', '{"wattage":1250,"efficiency_rating":"gold","modular":true,"form_factor":"ATX"}', 2022, true),
('generic-psu-1500w', '1500W PSU (generic)', 'Generic', 'psu', '{"wattage":1500,"efficiency_rating":"platinum","modular":true,"form_factor":"ATX"}', 2022, true),
('generic-psu-1600w', '1600W PSU (generic)', 'Generic', 'psu', '{"wattage":1600,"efficiency_rating":"titanium","modular":true,"form_factor":"ATX"}', 2022, true),
('generic-psu-1650w', '1650W PSU (generic)', 'Generic', 'psu', '{"wattage":1650,"efficiency_rating":"gold","modular":true,"form_factor":"ATX"}', 2023, true)
ON CONFLICT (slug) DO NOTHING;
