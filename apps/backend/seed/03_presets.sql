-- Seed Preset Builds: 4 curated builds for different use cases
-- Uses subqueries on slug so IDs don't need to be hardcoded.
-- Safe to run multiple times — skips if preset name already exists.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Budget Gaming (~8500 MAD) — 1080p gaming on AM4
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO preset_builds (name, description, use_case, total_price_estimate, is_active)
SELECT 'Budget Gaming Build', '1080p gaming on a tight budget. Solid performance in most titles.', 'gaming', 8500.00, true
WHERE NOT EXISTS (SELECT 1 FROM preset_builds WHERE name = 'Budget Gaming Build');

INSERT INTO preset_build_components (preset_build_id, component_id, category)
SELECT p.id, c.id, c.category
FROM preset_builds p, components c
WHERE p.name = 'Budget Gaming Build'
  AND c.slug IN (
    'amd-ryzen-5-5600x',
    'msi-b450-gaming-plus-max',
    'nvidia-rtx-4060-ti-16gb',
    'kingston-fury-beast-16gb-ddr4-3600',
    'lexar-nm790-1tb',
    'be-quiet-pure-power-12-750w',
    'deepcool-ch510',
    'deepcool-ak400'
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
    'msi-mag-b650-tomahawk-wifi',
    'amd-rx-7700-xt',
    'lexar-ares-32gb-ddr5-6000',
    'samsung-990-pro-2tb',
    'msi-mag-a850gl',
    'nzxt-h6-flow',
    'arctic-liquid-freezer-ii-360'
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
    'amd-ryzen-9-7950x3d',
    'msi-pro-z890-a-wifi',
    'nvidia-rtx-5080',
    'gskill-trident-z5-96gb-ddr5-6000',
    'samsung-990-pro-4tb',
    'corsair-hx1000',
    'lian-li-o11-dynamic-evo',
    'corsair-h150i-elite-lcd'
  )
ON CONFLICT (preset_build_id, category) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Office PC (~4500 MAD) — everyday productivity
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
    'msi-b760m-gaming-plus-wifi',
    'kingston-fury-beast-16gb-ddr4-3600',
    'lexar-nm790-1tb',
    'be-quiet-pure-power-12-750w',
    'deepcool-matrexx-55',
    'arctic-freezer-36'
  )
ON CONFLICT (preset_build_id, category) DO NOTHING;
