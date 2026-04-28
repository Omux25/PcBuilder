-- Missing CPUs found by find_missing_catalog.ts
-- These are products UltraPC sells that have no catalog entry.
-- Run with: psql -U pc_builder_user -d pc_builder -f backend/scripts/add_missing_cpus.sql

-- ── Intel Core Ultra (Arrow Lake) ─────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('intel-core-ultra-5-245k',  'Core Ultra 5 245K',  'Intel', 'cpu', '{"socket":"LGA1851","cores":14,"threads":14,"base_clock_ghz":4.2,"boost_clock_ghz":5.2,"tdp":125}', 2024, true),
('intel-core-ultra-5-245kf', 'Core Ultra 5 245KF', 'Intel', 'cpu', '{"socket":"LGA1851","cores":14,"threads":14,"base_clock_ghz":4.2,"boost_clock_ghz":5.2,"tdp":125}', 2024, true),
('intel-core-ultra-5-225f',  'Core Ultra 5 225F',  'Intel', 'cpu', '{"socket":"LGA1851","cores":14,"threads":14,"base_clock_ghz":3.3,"boost_clock_ghz":4.9,"tdp":65}',  2024, true),
('intel-core-ultra-7-265k',  'Core Ultra 7 265K',  'Intel', 'cpu', '{"socket":"LGA1851","cores":20,"threads":20,"base_clock_ghz":3.9,"boost_clock_ghz":5.5,"tdp":125}', 2024, true),
('intel-core-ultra-7-265kf', 'Core Ultra 7 265KF', 'Intel', 'cpu', '{"socket":"LGA1851","cores":20,"threads":20,"base_clock_ghz":3.9,"boost_clock_ghz":5.5,"tdp":125}', 2024, true)
ON CONFLICT (slug) DO NOTHING;

-- ── AMD Ryzen 9000 X3D (Zen 5 V-Cache) ───────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('amd-ryzen-9-9950x3d', 'Ryzen 9 9950X3D', 'AMD', 'cpu', '{"socket":"AM5","cores":16,"threads":32,"base_clock_ghz":4.3,"boost_clock_ghz":5.7,"tdp":170}', 2025, true),
('amd-ryzen-9-9900x3d', 'Ryzen 9 9900X3D', 'AMD', 'cpu', '{"socket":"AM5","cores":12,"threads":24,"base_clock_ghz":4.4,"boost_clock_ghz":5.5,"tdp":120}', 2025, true),
('amd-ryzen-7-9850x3d', 'Ryzen 7 9850X3D', 'AMD', 'cpu', '{"socket":"AM5","cores":8,"threads":16,"base_clock_ghz":4.7,"boost_clock_ghz":5.6,"tdp":65}',  2025, true)
ON CONFLICT (slug) DO NOTHING;

-- ── AMD Ryzen 7000 X3D (missing) ─────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('amd-ryzen-9-7900x3d', 'Ryzen 9 7900X3D', 'AMD', 'cpu', '{"socket":"AM5","cores":12,"threads":24,"base_clock_ghz":4.4,"boost_clock_ghz":5.6,"tdp":120}', 2023, true)
ON CONFLICT (slug) DO NOTHING;

-- ── AMD Ryzen 5000 X3D ────────────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('amd-ryzen-7-5700x3d', 'Ryzen 7 5700X3D', 'AMD', 'cpu', '{"socket":"AM4","cores":8,"threads":16,"base_clock_ghz":3.0,"boost_clock_ghz":4.1,"tdp":105}', 2024, true),
('amd-ryzen-7-5800x3d', 'Ryzen 7 5800X3D', 'AMD', 'cpu', '{"socket":"AM4","cores":8,"threads":16,"base_clock_ghz":3.4,"boost_clock_ghz":4.5,"tdp":105}', 2022, true)
ON CONFLICT (slug) DO NOTHING;

-- ── AMD Ryzen 9000 non-X3D (missing) ─────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('amd-ryzen-5-9600',  'Ryzen 5 9600',  'AMD', 'cpu', '{"socket":"AM5","cores":6,"threads":12,"base_clock_ghz":3.8,"boost_clock_ghz":5.2,"tdp":65}',  2024, true)
ON CONFLICT (slug) DO NOTHING;

-- ── AMD Ryzen 7000 non-X3D (missing) ─────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('amd-ryzen-9-7900',  'Ryzen 9 7900',  'AMD', 'cpu', '{"socket":"AM5","cores":12,"threads":24,"base_clock_ghz":3.7,"boost_clock_ghz":5.4,"tdp":65}',  2022, true),
('amd-ryzen-5-7500f', 'Ryzen 5 7500F', 'AMD', 'cpu', '{"socket":"AM5","cores":6,"threads":12,"base_clock_ghz":3.7,"boost_clock_ghz":5.0,"tdp":65}',  2023, true)
ON CONFLICT (slug) DO NOTHING;

-- ── AMD Ryzen 5000 (missing variants) ────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('amd-ryzen-5-5500',   'Ryzen 5 5500',   'AMD', 'cpu', '{"socket":"AM4","cores":6,"threads":12,"base_clock_ghz":3.6,"boost_clock_ghz":4.2,"tdp":65}',  2021, true),
('amd-ryzen-5-5600g',  'Ryzen 5 5600G',  'AMD', 'cpu', '{"socket":"AM4","cores":6,"threads":12,"base_clock_ghz":3.9,"boost_clock_ghz":4.4,"tdp":65}',  2021, true),
('amd-ryzen-5-5600t',  'Ryzen 5 5600T',  'AMD', 'cpu', '{"socket":"AM4","cores":6,"threads":12,"base_clock_ghz":3.7,"boost_clock_ghz":4.5,"tdp":65}',  2022, true),
('amd-ryzen-5-5600xt', 'Ryzen 5 5600XT', 'AMD', 'cpu', '{"socket":"AM4","cores":6,"threads":12,"base_clock_ghz":3.7,"boost_clock_ghz":4.7,"tdp":65}',  2024, true),
('amd-ryzen-7-5700',   'Ryzen 7 5700',   'AMD', 'cpu', '{"socket":"AM4","cores":8,"threads":16,"base_clock_ghz":3.7,"boost_clock_ghz":4.6,"tdp":65}',  2022, true),
('amd-ryzen-7-5700g',  'Ryzen 7 5700G',  'AMD', 'cpu', '{"socket":"AM4","cores":8,"threads":16,"base_clock_ghz":3.8,"boost_clock_ghz":4.6,"tdp":65}',  2021, true),
('amd-ryzen-7-5800xt', 'Ryzen 7 5800XT', 'AMD', 'cpu', '{"socket":"AM4","cores":8,"threads":16,"base_clock_ghz":3.8,"boost_clock_ghz":4.8,"tdp":105}', 2024, true),
('amd-ryzen-9-5900xt', 'Ryzen 9 5900XT', 'AMD', 'cpu', '{"socket":"AM4","cores":12,"threads":24,"base_clock_ghz":3.3,"boost_clock_ghz":4.8,"tdp":105}', 2024, true)
ON CONFLICT (slug) DO NOTHING;

-- ── AMD Ryzen 8000 (missing) ──────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('amd-ryzen-5-8400f',  'Ryzen 5 8400F',  'AMD', 'cpu', '{"socket":"AM5","cores":6,"threads":12,"base_clock_ghz":4.2,"boost_clock_ghz":4.7,"tdp":65}',  2024, true),
('amd-ryzen-5-8500g',  'Ryzen 5 8500G',  'AMD', 'cpu', '{"socket":"AM5","cores":6,"threads":12,"base_clock_ghz":3.5,"boost_clock_ghz":5.0,"tdp":65}',  2024, true),
('amd-ryzen-7-8700f',  'Ryzen 7 8700F',  'AMD', 'cpu', '{"socket":"AM5","cores":8,"threads":16,"base_clock_ghz":4.1,"boost_clock_ghz":5.0,"tdp":65}',  2024, true),
('amd-ryzen-7-8700g',  'Ryzen 7 8700G',  'AMD', 'cpu', '{"socket":"AM5","cores":8,"threads":16,"base_clock_ghz":4.2,"boost_clock_ghz":5.1,"tdp":65}',  2024, true)
ON CONFLICT (slug) DO NOTHING;

-- ── AMD Ryzen 4000 (missing) ──────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('amd-ryzen-5-4500',  'Ryzen 5 4500',  'AMD', 'cpu', '{"socket":"AM4","cores":6,"threads":12,"base_clock_ghz":3.6,"boost_clock_ghz":4.1,"tdp":65}', 2021, true),
('amd-ryzen-5-4600g', 'Ryzen 5 4600G', 'AMD', 'cpu', '{"socket":"AM4","cores":6,"threads":12,"base_clock_ghz":3.7,"boost_clock_ghz":4.2,"tdp":65}', 2021, true)
ON CONFLICT (slug) DO NOTHING;

-- ── AMD Ryzen 3000 (missing) ──────────────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('amd-ryzen-5-3600',  'Ryzen 5 3600',  'AMD', 'cpu', '{"socket":"AM4","cores":6,"threads":12,"base_clock_ghz":3.6,"boost_clock_ghz":4.2,"tdp":65}', 2019, true),
('amd-ryzen-5-3500x', 'Ryzen 5 3500X', 'AMD', 'cpu', '{"socket":"AM4","cores":6,"threads":6, "base_clock_ghz":3.6,"boost_clock_ghz":4.1,"tdp":65}', 2019, true),
('amd-ryzen-3-3100',  'Ryzen 3 3100',  'AMD', 'cpu', '{"socket":"AM4","cores":4,"threads":8, "base_clock_ghz":3.6,"boost_clock_ghz":3.9,"tdp":65}', 2020, true),
('amd-ryzen-3-4100',  'Ryzen 3 4100',  'AMD', 'cpu', '{"socket":"AM4","cores":4,"threads":8, "base_clock_ghz":3.8,"boost_clock_ghz":4.0,"tdp":65}', 2022, true)
ON CONFLICT (slug) DO NOTHING;

-- ── Intel 14th gen non-K (missing) ───────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('intel-core-i9-14900',   'Core i9-14900',   'Intel', 'cpu', '{"socket":"LGA1700","cores":24,"threads":32,"base_clock_ghz":2.0,"boost_clock_ghz":5.8,"tdp":65}',  2023, true),
('intel-core-i9-14900f',  'Core i9-14900F',  'Intel', 'cpu', '{"socket":"LGA1700","cores":24,"threads":32,"base_clock_ghz":2.0,"boost_clock_ghz":5.8,"tdp":65}',  2023, true),
('intel-core-i7-14700f',  'Core i7-14700F',  'Intel', 'cpu', '{"socket":"LGA1700","cores":20,"threads":28,"base_clock_ghz":2.1,"boost_clock_ghz":5.4,"tdp":65}',  2023, true),
('intel-core-i5-14500',   'Core i5-14500',   'Intel', 'cpu', '{"socket":"LGA1700","cores":14,"threads":20,"base_clock_ghz":2.6,"boost_clock_ghz":5.0,"tdp":65}',  2023, true),
('intel-core-i5-14400',   'Core i5-14400',   'Intel', 'cpu', '{"socket":"LGA1700","cores":10,"threads":16,"base_clock_ghz":2.5,"boost_clock_ghz":4.7,"tdp":65}',  2023, true),
('intel-core-i5-14600kf', 'Core i5-14600KF', 'Intel', 'cpu', '{"socket":"LGA1700","cores":14,"threads":20,"base_clock_ghz":3.5,"boost_clock_ghz":5.3,"tdp":125}', 2023, true),
('intel-core-i3-14100',   'Core i3-14100',   'Intel', 'cpu', '{"socket":"LGA1700","cores":4,"threads":8,"base_clock_ghz":3.5,"boost_clock_ghz":4.7,"tdp":60}',   2023, true),
('intel-core-i3-14100f',  'Core i3-14100F',  'Intel', 'cpu', '{"socket":"LGA1700","cores":4,"threads":8,"base_clock_ghz":3.5,"boost_clock_ghz":4.7,"tdp":58}',   2023, true)
ON CONFLICT (slug) DO NOTHING;

-- ── Intel 13th gen non-K (missing) ───────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('intel-core-i5-13500',   'Core i5-13500',   'Intel', 'cpu', '{"socket":"LGA1700","cores":14,"threads":20,"base_clock_ghz":2.5,"boost_clock_ghz":4.8,"tdp":65}',  2022, true),
('intel-core-i5-13400',   'Core i5-13400',   'Intel', 'cpu', '{"socket":"LGA1700","cores":10,"threads":16,"base_clock_ghz":2.5,"boost_clock_ghz":4.6,"tdp":65}',  2022, true),
('intel-core-i3-13100f',  'Core i3-13100F',  'Intel', 'cpu', '{"socket":"LGA1700","cores":4,"threads":8,"base_clock_ghz":3.4,"boost_clock_ghz":4.5,"tdp":58}',   2022, true)
ON CONFLICT (slug) DO NOTHING;

-- ── Intel 12th gen non-K (missing) ───────────────────────────────────────────
INSERT INTO components (slug, name, brand, category, specs, release_year, is_active) VALUES
('intel-core-i7-12700kf', 'Core i7-12700KF', 'Intel', 'cpu', '{"socket":"LGA1700","cores":12,"threads":20,"base_clock_ghz":3.6,"boost_clock_ghz":5.0,"tdp":125}', 2021, true),
('intel-core-i5-12400',   'Core i5-12400',   'Intel', 'cpu', '{"socket":"LGA1700","cores":6,"threads":12,"base_clock_ghz":2.5,"boost_clock_ghz":4.4,"tdp":65}',  2021, true),
('intel-core-i3-12100',   'Core i3-12100',   'Intel', 'cpu', '{"socket":"LGA1700","cores":4,"threads":8,"base_clock_ghz":3.3,"boost_clock_ghz":4.3,"tdp":60}',   2021, true),
('intel-core-i3-10100f',  'Core i3-10100F',  'Intel', 'cpu', '{"socket":"LGA1200","cores":4,"threads":8,"base_clock_ghz":3.6,"boost_clock_ghz":4.3,"tdp":65}',   2020, true)
ON CONFLICT (slug) DO NOTHING;
