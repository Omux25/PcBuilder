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
      WITH cheapest_prices AS (
        SELECT id, component_id, price, ROW_NUMBER() OVER(PARTITION BY component_id ORDER BY price ASC) as rn
        FROM prices
        WHERE in_stock = true
      ),
      preset_details AS (
        SELECT 
          pb.id, pb.name, pb.description, pb.use_case, pb.is_active, pb.is_featured, pb.created_at, pb.updated_at,
          jsonb_object_agg(pbc.category, jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'brand', c.brand,
            'slug', c.slug,
            'image_url', c.image_url,
            'is_active', c.is_active
          )) as components,
          SUM(cp.price) as total_price_estimate
        FROM preset_builds pb
        JOIN preset_build_components pbc ON pbc.preset_build_id = pb.id
        JOIN components c ON c.id = pbc.component_id
        LEFT JOIN cheapest_prices cp ON cp.component_id = pbc.component_id AND cp.rn = 1
        WHERE (${includeInactive ? null : true}::boolean IS NULL OR pb.is_active = true)
        AND (${useCase ?? null}::text IS NULL OR pb.use_case = ${useCase ?? null})
        GROUP BY pb.id
      )
      SELECT 
        *,
        (
          EXISTS (
            SELECT 1 FROM preset_build_components pbc2
            LEFT JOIN prices p2 ON p2.component_id = pbc2.component_id AND p2.in_stock = true
            WHERE pbc2.preset_build_id = preset_details.id AND p2.id IS NULL
          ) OR
          (
            SELECT COUNT(DISTINCT pbc3.category) 
            FROM preset_build_components pbc3 
            WHERE pbc3.preset_build_id = preset_details.id 
            AND pbc3.category IN ('cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooling')
          ) < 8
        ) as incomplete
      FROM preset_details
      ORDER BY preset_details.total_price_estimate ASC
    ` as any[];

    return rows.map(r => ({
      ...r,
      total_price_estimate: r.total_price_estimate ? Number(r.total_price_estimate) : null
    }));
  }

  async getPresetById(id: number): Promise<PresetBuild> {
    const sql = getSql();
    const rows = await sql`
      WITH cheapest_prices AS (
        SELECT id, component_id, price, ROW_NUMBER() OVER(PARTITION BY component_id ORDER BY price ASC) as rn
        FROM prices
        WHERE in_stock = true
      )
      SELECT 
        pb.id, pb.name, pb.description, pb.use_case, pb.is_active, pb.is_featured, pb.created_at, pb.updated_at,
        jsonb_object_agg(pbc.category, jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'brand', c.brand,
          'slug', c.slug,
          'image_url', c.image_url,
          'is_active', c.is_active
        )) as components,
        SUM(cp.price) as total_price_estimate,
        (
          EXISTS (
            SELECT 1 FROM preset_build_components pbc2
            LEFT JOIN prices p2 ON p2.component_id = pbc2.component_id AND p2.in_stock = true
            WHERE pbc2.preset_build_id = pb.id AND p2.id IS NULL
          ) OR
          (
            SELECT COUNT(DISTINCT pbc3.category) 
            FROM preset_build_components pbc3 
            WHERE pbc3.preset_build_id = pb.id 
            AND pbc3.category IN ('cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooling')
          ) < 8
        ) as incomplete
      FROM preset_builds pb
      JOIN preset_build_components pbc ON pbc.preset_build_id = pb.id
      JOIN components c ON c.id = pbc.component_id
      LEFT JOIN cheapest_prices cp ON cp.component_id = pbc.component_id AND cp.rn = 1
      WHERE pb.id = ${id}
      GROUP BY pb.id
    ` as any[];

    if (rows.length === 0) {
      throw new AppError('PRESET_NOT_FOUND', `Preset build with id ${id} not found`, 404);
    }

    return {
      ...rows[0],
      total_price_estimate: rows[0].total_price_estimate ? Number(rows[0].total_price_estimate) : null
    };
  }

  async createPreset(data: { name: string; description?: string; use_case: string; is_featured?: boolean; components: Record<string, number> }) {
    const sql = getSql();
    
    return await sql.begin(async (tx) => {
      const inserted = (await tx`
        INSERT INTO preset_builds (name, description, use_case, is_active, is_featured)
        VALUES (${data.name}, ${data.description ?? null}, ${data.use_case}, true, ${data.is_featured ?? false})
        RETURNING *
      `) as any[];

      const presetId = inserted[0].id;

      const componentsToInsert = Object.entries(data.components).map(([category, component_id]) => ({
        preset_build_id: presetId,
        category,
        component_id
      }));

      if (componentsToInsert.length > 0) {
        await tx`
          INSERT INTO preset_build_components ${tx(componentsToInsert)}
        `;
      }

      return this.getPresetById(presetId);
    });
  }

  async updatePreset(id: number, data: Partial<{ name: string; description: string; use_case: string; is_featured: boolean; components: Record<string, number> }>) {
    const sql = getSql();

    return await sql.begin(async (tx) => {
      if (data.name !== undefined || data.description !== undefined || data.use_case !== undefined || data.is_featured !== undefined) {
        await tx`
          UPDATE preset_builds SET
            name        = COALESCE(${data.name ?? null}, name),
            description = COALESCE(${data.description ?? null}, description),
            use_case    = COALESCE(${data.use_case ?? null}, use_case),
            is_featured = COALESCE(${data.is_featured ?? null}, is_featured)
          WHERE id = ${id}
        `;
      }

      if (data.components) {
        await tx`DELETE FROM preset_build_components WHERE preset_build_id = ${id}`;

        const componentsToInsert = Object.entries(data.components).map(([category, component_id]) => ({
          preset_build_id: id,
          category,
          component_id
        }));

        if (componentsToInsert.length > 0) {
          await tx`
            INSERT INTO preset_build_components ${tx(componentsToInsert)}
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
