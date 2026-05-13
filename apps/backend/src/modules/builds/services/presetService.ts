import { getSql } from '../../../core/db/index.js';
import { AppError } from '../../../core/errors/errors.js';

export interface PresetBuild {
  id: number;
  name: string;
  description?: string;
  use_case: string;
  is_active: boolean;
  components: Record<string, any>;
  total_price: number;
}

export class PresetService {
  async getPresets(useCase?: string, includeInactive = false): Promise<PresetBuild[]> {
    const sql = getSql();
    const rows = await sql`
      SELECT 
        pb.*,
        jsonb_object_agg(pbc.category, pbc.component_id) as components,
        SUM(p.price) as total_price
      FROM preset_builds pb
      JOIN preset_build_components pbc ON pbc.preset_build_id = pb.id
      JOIN prices p ON p.component_id = pbc.component_id
      -- Get only the cheapest in-stock price for each component
      WHERE p.id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER(PARTITION BY component_id ORDER BY price ASC) as rn
          FROM prices
          WHERE in_stock = true
        ) t WHERE t.rn = 1
      )
      AND (${includeInactive ? null : true}::boolean IS NULL OR pb.is_active = true)
      AND (${useCase ?? null}::text IS NULL OR pb.use_case = ${useCase ?? null})
      GROUP BY pb.id
      ORDER BY total_price ASC
    ` as any[];

    return rows.map(r => ({
      ...r,
      total_price: Number(r.total_price)
    }));
  }

  async getPresetById(id: number): Promise<PresetBuild> {
    const sql = getSql();
    const rows = await sql`
      SELECT 
        pb.*,
        jsonb_object_agg(pbc.category, pbc.component_id) as components,
        SUM(p.price) as total_price
      FROM preset_builds pb
      JOIN preset_build_components pbc ON pbc.preset_build_id = pb.id
      JOIN prices p ON p.component_id = pbc.component_id
      WHERE pb.id = ${id}
      AND p.id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER(PARTITION BY component_id ORDER BY price ASC) as rn
          FROM prices
          WHERE in_stock = true
        ) t WHERE t.rn = 1
      )
      GROUP BY pb.id
    ` as any[];

    if (rows.length === 0) {
      throw new AppError('PRESET_NOT_FOUND', `Preset build with id ${id} not found`, 404);
    }

    return {
      ...rows[0],
      total_price: Number(rows[0].total_price)
    };
  }

  async createPreset(data: { name: string; description?: string; use_case: string; components: Record<string, number> }) {
    const sql = getSql();
    
    return await sql.begin(async (tx) => {
      const inserted = (await tx`
        INSERT INTO preset_builds (name, description, use_case, is_active)
        VALUES (${data.name}, ${data.description ?? null}, ${data.use_case}, true)
        RETURNING *
      `) as any[];

      const presetId = inserted[0].id;

      for (const [category, componentId] of Object.entries(data.components)) {
        await tx`
          INSERT INTO preset_build_components (preset_build_id, category, component_id)
          VALUES (${presetId}, ${category}, ${componentId})
        `;
      }

      return this.getPresetById(presetId);
    });
  }

  async updatePreset(id: number, data: Partial<{ name: string; description: string; use_case: string; components: Record<string, number> }>) {
    const sql = getSql();

    return await sql.begin(async (tx) => {
      if (data.name || data.description || data.use_case) {
        await tx`
          UPDATE preset_builds SET
            name        = COALESCE(${data.name ?? null}, name),
            description = COALESCE(${data.description ?? null}, description),
            use_case    = COALESCE(${data.use_case ?? null}, use_case)
          WHERE id = ${id}
        `;
      }

      if (data.components) {
        await tx`DELETE FROM preset_build_components WHERE preset_build_id = ${id}`;
        for (const [category, componentId] of Object.entries(data.components)) {
          await tx`
            INSERT INTO preset_build_components (preset_build_id, category, component_id)
            VALUES (${id}, ${category}, ${componentId})
          `;
        }
      }

      return this.getPresetById(id);
    });
  }

  async deletePreset(id: number) {
    const sql = getSql();
    await sql.begin(async (tx) => {
      await tx`DELETE FROM preset_build_components WHERE preset_build_id = ${id}`;
      await tx`DELETE FROM preset_builds WHERE id = ${id}`;
    });
  }
}
