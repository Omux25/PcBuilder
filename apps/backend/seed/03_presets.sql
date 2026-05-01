-- Seed Preset Builds: 4 curated builds for different use cases
-- Uses subqueries on slug so IDs don't need to be hardcoded.
-- Safe to run multiple times — skips if preset name already exists.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Budget Gaming (~8500 MAD) — 1080p gaming on AM4
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO preset_builds (name, description, use_case, total_price_estimate, is_active)
SELECT 'Budget Gaming Build', '1080p gaming on a tight budget. Solid 60fps in most titles.', 'gaming', 8500.00, true
WHERE NOT EXISTS (SELECT 1 FROM preset_builds WHERE name = 'Budget Gaming Build');

INSERT INTO preset_build_components (preset_build_id, component_id, category)
SELECT p.id, c.id, c.category
FROM preset_builds p, components c
WHERE p.name = 'Budget Gaming Build'
  AND c.slug IN (
    'amd-ryzen-5-5600',
    'msi-b550-a-pro',
    'amd-rx-6600',
    'kingston-fury-beast-16gb-ddr4-3200',
    'wd-blue-sn570-1tb',
    'corsair-cv550',
    'nzxt-h510',
    'coolermaster-hyper-212-black'
  )
ON CONFLICT (preset_build_id, category) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Mid-Range Gaming (~15000 MAD) — 1440p gaming on AM5
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO preset_builds (name, description, use_case, total_price_estimate, is_active)
SELECT 'Mid-Range Gaming Build', '1440p gaming with high framerates. Great price-to-performance.', 'gaming', 15000.00, true
WHERE NOT EXISTS (SELECT 1 FROM preset_builds WHERE name = 'Mid-Range Gaming Build');

INSERT INTO preset_build_components (preset_build_id, component_id, category)
SELECT p.id, c.id, c.category
FROM preset_builds p, components c
WHERE p.name = 'Mid-Range Gaming Build'
  AND c.slug IN (
    'amd-ryzen-5-7600',
    'asus-prime-b650-plus',
    'amd-rx-7700-xt',
    'corsair-vengeance-ddr5-32gb-5600',
    'samsung-980-pro-1tb',
    'corsair-rm750x',
    'corsair-4000d-airflow',
    'arctic-liquid-freezer-ii-240'
  )
ON CONFLICT (preset_build_id, category) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Workstation (~25000 MAD) — 4K video editing and 3D rendering
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO preset_builds (name, description, use_case, total_price_estimate, is_active)
SELECT 'High-End Workstation', '4K video editing, 3D rendering, and heavy multitasking.', 'workstation', 25000.00, true
WHERE NOT EXISTS (SELECT 1 FROM preset_builds WHERE name = 'High-End Workstation');

INSERT INTO preset_build_components (preset_build_id, component_id, category)
SELECT p.id, c.id, c.category
FROM preset_builds p, components c
WHERE p.name = 'High-End Workstation'
  AND c.slug IN (
    'amd-ryzen-9-7950x',
    'msi-x670e-ace',
    'nvidia-rtx-4070',
    'gskill-trident-z5-64gb-ddr5-6000',
    'wd-black-sn850x-1tb',
    'corsair-rm1000x',
    'lian-li-o11-dynamic',
    'noctua-nh-d15'
  )
ON CONFLICT (preset_build_id, category) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Office PC (~4500 MAD) — everyday productivity
-- Note: intentionally has no GPU slot — office PCs use CPU integrated graphics.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO preset_builds (name, description, use_case, total_price_estimate, is_active)
SELECT 'Office PC', 'Reliable everyday PC for browsing, office apps, and light work.', 'office', 4500.00, true
WHERE NOT EXISTS (SELECT 1 FROM preset_builds WHERE name = 'Office PC');

INSERT INTO preset_build_components (preset_build_id, component_id, category)
SELECT p.id, c.id, c.category
FROM preset_builds p, components c
WHERE p.name = 'Office PC'
  AND c.slug IN (
    'intel-core-i3-12100f',
    'gigabyte-b760-ds3h',
    'kingston-fury-beast-16gb-ddr4-3200',
    'crucial-p3-1tb-nvme',
    'msi-mag-a650bn',
    'fractal-meshify-c',
    'coolermaster-hyper-212-black'
  )
ON CONFLICT (preset_build_id, category) DO NOTHING;
