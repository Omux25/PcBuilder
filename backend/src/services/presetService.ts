/**
 * Preset Service — Curated PC build management.
 *
 * Requirements: 10.1, 10.5, 14.1
 */

import { sql as bunSql } from 'bun';

// ── Dependency injection ─────────────────────────────────────────────────────

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

let _sql: SqlFn = bunSql as unknown as SqlFn;

export function setSql(mockSql: SqlFn): void {
  _sql = mockSql;
}

export function resetSql(): void {
  _sql = bunSql as unknown as SqlFn;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface PresetComponent {
  id: number;
  slug: string;
  name: string;
  brand?: string;
  category: string;
  image_url?: string;
  is_active: boolean;
}

export interface PresetBuild {
  id: number;
  name: string;
  description?: string;
  use_case: 'gaming' | 'workstation' | 'office' | 'budget';
  total_price_estimate?: number;
  is_active: boolean;
  incomplete: boolean;
  components: Record<string, PresetComponent>;
  created_at: string;
  updated_at: string;
}

// ── Service Functions ────────────────────────────────────────────────────────

/**
 * Returns all active preset builds with their components.
 * Flags a preset as `incomplete` if any of its components are inactive.
 *
 * @param useCase - Optional filter by use case
 */
async function getPresets(useCase?: string): Promise<PresetBuild[]> {
  const presetRows = (await _sql`
    SELECT * FROM preset_builds
    WHERE is_active = true
      AND (${useCase ?? null}::text IS NULL OR use_case = ${useCase ?? null})
    ORDER BY use_case, name
  `) as Omit<PresetBuild, 'components' | 'incomplete'>[];

  if (presetRows.length === 0) return [];

  // Fetch all components for these presets in one query
  const presetIds = presetRows.map((p) => p.id);
  const componentRows = (await _sql`
    SELECT
      pbc.preset_build_id,
      pbc.category,
      c.id, c.slug, c.name, c.brand, c.image_url, c.is_active
    FROM preset_build_components pbc
    JOIN components c ON c.id = pbc.component_id
    WHERE pbc.preset_build_id = ANY(${presetIds}::int[])
  `) as (PresetComponent & { preset_build_id: number; category: string })[];

  // Group components by preset
  const componentsByPreset = new Map<number, Record<string, PresetComponent>>();
  for (const row of componentRows) {
    if (!componentsByPreset.has(row.preset_build_id)) {
      componentsByPreset.set(row.preset_build_id, {});
    }
    const { preset_build_id: _pid, ...component } = row;
    componentsByPreset.get(row.preset_build_id)![row.category] = component;
  }

  return presetRows.map((preset) => {
    const components = componentsByPreset.get(preset.id) ?? {};
    const incomplete = Object.values(components).some((c) => !c.is_active);
    return { ...preset, components, incomplete };
  });
}

/**
 * Returns a single preset build by ID with full component data.
 * Throws PRESET_NOT_FOUND if not found.
 */
async function getPresetById(id: number): Promise<PresetBuild> {
  const presetRows = (await _sql`
    SELECT * FROM preset_builds WHERE id = ${id} LIMIT 1
  `) as Omit<PresetBuild, 'components' | 'incomplete'>[];

  if (presetRows.length === 0) {
    const err = new Error(`Preset build with id ${id} not found`);
    (err as NodeJS.ErrnoException).code = 'PRESET_NOT_FOUND';
    throw err;
  }

  const componentRows = (await _sql`
    SELECT
      pbc.category,
      c.id, c.slug, c.name, c.brand, c.image_url, c.is_active
    FROM preset_build_components pbc
    JOIN components c ON c.id = pbc.component_id
    WHERE pbc.preset_build_id = ${id}
  `) as (PresetComponent & { category: string })[];

  const components: Record<string, PresetComponent> = {};
  for (const row of componentRows) {
    const { category, ...component } = row;
    components[category] = component;
  }

  const incomplete = Object.values(components).some((c) => !c.is_active);
  return { ...presetRows[0], components, incomplete };
}

/**
 * Creates a new preset build with its component links in a transaction.
 *
 * @param data.components - Map of category → component_id
 */
async function createPreset(data: {
  name: string;
  description?: string;
  use_case: string;
  total_price_estimate?: number;
  components: Record<string, number>;
}): Promise<PresetBuild> {
  // Insert preset
  const presetRows = (await _sql`
    INSERT INTO preset_builds (name, description, use_case, total_price_estimate, is_active)
    VALUES (
      ${data.name},
      ${data.description ?? null},
      ${data.use_case},
      ${data.total_price_estimate ?? null},
      true
    )
    RETURNING *
  `) as Omit<PresetBuild, 'components' | 'incomplete'>[];

  const preset = presetRows[0];

  // Insert component links
  for (const [category, componentId] of Object.entries(data.components)) {
    await _sql`
      INSERT INTO preset_build_components (preset_build_id, component_id, category)
      VALUES (${preset.id}, ${componentId}, ${category})
      ON CONFLICT (preset_build_id, category) DO UPDATE SET component_id = ${componentId}
    `;
  }

  return getPresetById(preset.id);
}

/**
 * Updates a preset build and replaces its component links.
 * Throws PRESET_NOT_FOUND if no preset matches.
 */
async function updatePreset(
  id: number,
  data: {
    name?: string;
    description?: string;
    use_case?: string;
    total_price_estimate?: number;
    components?: Record<string, number>;
  }
): Promise<PresetBuild> {
  const rows = (await _sql`
    UPDATE preset_builds SET
      name                 = COALESCE(${data.name ?? null}, name),
      description          = COALESCE(${data.description ?? null}, description),
      use_case             = COALESCE(${data.use_case ?? null}, use_case),
      total_price_estimate = COALESCE(${data.total_price_estimate ?? null}, total_price_estimate),
      updated_at           = NOW()
    WHERE id = ${id}
    RETURNING *
  `) as Omit<PresetBuild, 'components' | 'incomplete'>[];

  if (rows.length === 0) {
    const err = new Error(`Preset build with id ${id} not found`);
    (err as NodeJS.ErrnoException).code = 'PRESET_NOT_FOUND';
    throw err;
  }

  // Replace component links if provided
  if (data.components) {
    await _sql`DELETE FROM preset_build_components WHERE preset_build_id = ${id}`;
    for (const [category, componentId] of Object.entries(data.components)) {
      await _sql`
        INSERT INTO preset_build_components (preset_build_id, component_id, category)
        VALUES (${id}, ${componentId}, ${category})
      `;
    }
  }

  return getPresetById(id);
}

/**
 * Deletes a preset build (cascades to preset_build_components).
 * Throws PRESET_NOT_FOUND if no preset matches.
 */
async function deletePreset(id: number): Promise<void> {
  const rows = (await _sql`
    DELETE FROM preset_builds WHERE id = ${id} RETURNING id
  `) as { id: number }[];

  if (rows.length === 0) {
    const err = new Error(`Preset build with id ${id} not found`);
    (err as NodeJS.ErrnoException).code = 'PRESET_NOT_FOUND';
    throw err;
  }
}

export { getPresets, getPresetById, createPreset, updatePreset, deletePreset };
