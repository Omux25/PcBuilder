/**
 * Preset Service — Curated PC build management.
 *
 * Requirements: 10.1, 10.5, 14.1
 */

import { getSql } from '../db/index.js';
import { AppError } from '../utils/errors.js';
import { PresetComponent, PresetBuild } from '@shared/types';

// ── Service Functions ────────────────────────────────────────────────────────

/**
 * Returns all preset builds with their components.
 * Flags a preset as `incomplete` if any of its components are inactive.
 *
 * @param useCase        - Optional filter by use case
 * @param includeInactive - If true, includes inactive presets (default false)
 */
async function getPresets(useCase?: string, includeInactive = false): Promise<PresetBuild[]> {
  const sql = getSql();
  const presetRows = (await sql`
    SELECT * FROM preset_builds
    WHERE (${includeInactive ? null : true}::boolean IS NULL OR is_active = true)
      AND (${useCase ?? null}::text IS NULL OR use_case = ${useCase ?? null})
    ORDER BY use_case, name
  `) as Omit<PresetBuild, 'components' | 'incomplete'>[];

  if (presetRows.length === 0) return [];

  // Fetch all components for these presets in one query
  // Use a JOIN against preset_builds instead of passing an array parameter (Bun.sql limitation)
  const componentRows = (await sql`
    SELECT
      pbc.preset_build_id,
      pbc.category,
      c.id, c.slug, c.name, c.brand, c.image_url, c.is_active
    FROM preset_build_components pbc
    JOIN components c ON c.id = pbc.component_id
    JOIN preset_builds pb ON pb.id = pbc.preset_build_id
    WHERE (${includeInactive ? null : true}::boolean IS NULL OR pb.is_active = true)
      AND (${useCase ?? null}::text IS NULL OR pb.use_case = ${useCase ?? null})
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
  const sql = getSql();
  const presetRows = (await sql`
    SELECT * FROM preset_builds WHERE id = ${id} LIMIT 1
  `) as Omit<PresetBuild, 'components' | 'incomplete'>[];

  if (presetRows.length === 0) {
    throw new AppError('PRESET_NOT_FOUND', `Preset build with id ${id} not found`, 404);
  }

  const componentRows = (await sql`
    SELECT
      pbc.category,
      c.id, c.slug, c.name, c.brand, c.image_url, c.is_active
    FROM preset_build_components pbc
    JOIN components c ON c.id = pbc.component_id
    WHERE pbc.preset_build_id = ${id}
  `) as (PresetComponent & { category: string })[];

  const components: Record<string, PresetComponent> = {};
  for (const row of componentRows) {
    components[row.category] = row;
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
  // Insert preset and component links in a transaction to prevent partial state
  // if the server crashes between the preset insert and the component link inserts.
  const sql = getSql();
  let presetId: number;

  await sql.begin(async (tx) => {
    const presetRows = (await tx`
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

    presetId = presetRows[0].id;

    for (const [category, componentId] of Object.entries(data.components)) {
      await tx`
        INSERT INTO preset_build_components (preset_build_id, component_id, category)
        VALUES (${presetId}, ${componentId}, ${category})
        ON CONFLICT (preset_build_id, category) DO UPDATE SET component_id = ${componentId}
      `;
    }
  });

  return getPresetById(presetId!);
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
  const sql = getSql();
  const rows = (await sql`
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
    throw new AppError('PRESET_NOT_FOUND', `Preset build with id ${id} not found`, 404);
  }

  // Replace component links if provided — wrapped in a transaction to prevent
  // partial state if the server crashes between DELETE and re-inserts.
  if (data.components) {
    await sql.begin(async (tx) => {
      await tx`DELETE FROM preset_build_components WHERE preset_build_id = ${id}`;
      for (const [category, componentId] of Object.entries(data.components!)) {
        await tx`
          INSERT INTO preset_build_components (preset_build_id, component_id, category)
          VALUES (${id}, ${componentId}, ${category})
        `;
      }
    });
  }

  return getPresetById(id);
}

/**
 * Deletes a preset build (cascades to preset_build_components).
 * Throws PRESET_NOT_FOUND if no preset matches.
 */
async function deletePreset(id: number): Promise<void> {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM preset_builds WHERE id = ${id} RETURNING id
  `) as { id: number }[];

  if (rows.length === 0) {
    throw new AppError('PRESET_NOT_FOUND', `Preset build with id ${id} not found`, 404);
  }
}

export { getPresets, getPresetById, createPreset, updatePreset, deletePreset };
