import { getSql } from '../../../core/db/index.js';
import { Component } from '@shared/types';

export interface ComponentFilters {
  category?: string;
  socket?: string;
  ram_type?: string;
  brand?: string;
  search?: string;
  sort?: string;
  vram_gb?: number;
  in_stock?: boolean;
  min_wattage?: number;
  max_wattage?: number;
  min_capacity_gb?: number;
  max_capacity_gb?: number;
  min_frequency_mhz?: number;
  max_frequency_mhz?: number;
  include_inactive?: boolean;
  is_active?: boolean;
}

export interface ComponentListResult {
  components: (Component & { lowest_price: number | null; in_stock: boolean })[];
  total: number;
  in_stock_total: number;
}

export class ComponentRepository {
  private sql = getSql();

  async getComponents(filters: ComponentFilters, limit: number, offset: number): Promise<ComponentListResult> {
    const { 
      category, socket, ram_type, brand, search, sort, vram_gb, in_stock, 
      min_wattage, max_wattage, min_capacity_gb, max_capacity_gb, 
      min_frequency_mhz, max_frequency_mhz,
      include_inactive, is_active 
    } = filters;

    // 1. Parse Sort
    let field = 'smart';
    let direction = 'asc';
    if (sort && sort !== 'smart') {
        const parts = sort.split('_');
        if (parts.length >= 2) {
            direction = parts.pop()!;
            field = parts.join('_');
        } else {
            field = sort;
        }
    }
    const dir = direction.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // 2. Build Where Clauses
    const whereClauses: string[] = [
        include_inactive ? '1=1' : 'is_active = true',
        is_active !== undefined ? `is_active = ${is_active}` : null,
        category ? `category = ${this.escape(category)}` : null,
        socket ? `socket = ${this.escape(socket)}` : null,
        ram_type ? `(ram_type = ${this.escape(ram_type)} OR ${this.escape(ram_type)} = ANY(supported_ram_types))` : null,
        brand ? `LOWER(brand) = LOWER(${this.escape(brand)})` : null,
        vram_gb ? `vram_gb = ${vram_gb}` : null,
        min_wattage ? `wattage >= ${min_wattage}` : null,
        max_wattage ? `wattage <= ${max_wattage}` : null,
        min_capacity_gb ? `capacity_gb >= ${min_capacity_gb}` : null,
        max_capacity_gb ? `capacity_gb <= ${max_capacity_gb}` : null,
        min_frequency_mhz ? `frequency_mhz >= ${min_frequency_mhz}` : null,
        max_frequency_mhz ? `frequency_mhz <= ${max_frequency_mhz}` : null,
    ].filter(Boolean) as string[];

    if (search && search.trim() !== '') {
        const tokens = search.toLowerCase().split(' ').filter(Boolean);
        for (const t of tokens) {
            whereClauses.push(`(LOWER(COALESCE(brand, '') || ' ' || name) LIKE ${this.escape('%' + t + '%')})`);
        }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 3. Define the Order By Logic (CRITICAL: One dir only)
    const validCols = ['wattage', 'frequency_mhz', 'core_count', 'thread_count', 'vram_gb', 'capacity_gb', 'read_speed_mbps', 'write_speed_mbps', 'height_mm', 'max_tdp', 'benchmark_score', 'ram_slots', 'kit_count', 'cas_latency', 'tdp', 'length_mm', 'max_gpu_length_mm', 'max_cooler_height_mm'];
    
    let orderExpr = '';
    if (field === 'price') {
        orderExpr = `final_price ${dir}`;
    } else if (field === 'name') {
        const nameExpr = `LOWER(TRIM(CASE 
            WHEN brand IS NOT NULL AND LOWER(name) NOT LIKE LOWER(brand) || '%' 
            THEN brand || ' ' || name 
            ELSE name 
        END))`;
        orderExpr = `${nameExpr} ${dir}, wattage ${dir}, vram_gb ${dir}, capacity_gb ${dir}, frequency_mhz ${dir}`;
    } else if (field === 'efficiency_rating') {
        orderExpr = `CASE 
            WHEN efficiency_rating ~* 'Titanium' THEN 7
            WHEN efficiency_rating ~* 'Platinum' THEN 6
            WHEN efficiency_rating ~* 'Gold' THEN 5
            WHEN efficiency_rating ~* 'Silver' THEN 4
            WHEN efficiency_rating ~* 'Bronze' THEN 3
            WHEN efficiency_rating ~* '80\\+' THEN 2
            ELSE 0 
        END ${dir}`;
    } else if (field === 'modular') {
        orderExpr = `CASE 
            WHEN modular ~* 'Full' THEN 3
            WHEN modular ~* 'Semi' THEN 2
            WHEN modular ~* 'Non' THEN 1
            ELSE 0 
        END ${dir}`;
    } else if (validCols.includes(field)) {
        orderExpr = `${field} ${dir}`;
    } else {
        // Smart sort (Pertinence)
        orderExpr = `is_in_stock DESC, final_price ASC`;
    }

    const finalSql = `
        SELECT * FROM (
            SELECT 
                *,
                (SELECT MIN(price) FROM prices WHERE component_id = components.id AND in_stock = true) as lowest_in_stock,
                (SELECT MIN(price) FROM prices WHERE component_id = components.id) as lowest_any,
                EXISTS (SELECT 1 FROM prices WHERE component_id = components.id AND in_stock = true) as is_in_stock
            FROM components
            ${whereSql}
        ) sub
        CROSS JOIN LATERAL (SELECT COALESCE(lowest_in_stock, lowest_any) as final_price) p_calc
        WHERE (${in_stock === true ? 'is_in_stock = true' : in_stock === false ? 'is_in_stock = false' : '1=1'})
        ORDER BY ${orderExpr} NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
    `;

    const rows = await this.sql.unsafe(finalSql) as any[];
    
    const countSql = `
        SELECT COUNT(*) as cnt FROM (
            SELECT 
                id,
                EXISTS (SELECT 1 FROM prices WHERE component_id = components.id AND in_stock = true) as is_in_stock
            FROM components
            ${whereSql}
        ) sub
        WHERE (${in_stock === true ? 'is_in_stock = true' : in_stock === false ? 'is_in_stock = false' : '1=1'})
    `;
    const total_rows = (await this.sql.unsafe(countSql)) as { cnt: string }[];
    const total = parseInt(total_rows[0].cnt, 10);

    const inStockCountSql = `
        SELECT COUNT(*) as cnt FROM (
            SELECT 
                id,
                EXISTS (SELECT 1 FROM prices WHERE component_id = components.id AND in_stock = true) as is_in_stock
            FROM components
            ${whereSql}
        ) sub
        WHERE is_in_stock = true
    `;
    const in_stock_rows = (await this.sql.unsafe(inStockCountSql)) as { cnt: string }[];
    const inStockTotal = parseInt(in_stock_rows[0].cnt, 10);

    return { 
        components: rows.map((c) => ({
            ...c,
            lowest_price: c.final_price ? Number(c.final_price) : null,
            in_stock: c.is_in_stock
        })), 
        total,
        in_stock_total: inStockTotal
    };
  }

  private escape(val: string): string {
      return `'${val.replace(/'/g, "''")}'`;
  }

  async getComponentById(id: number, activeOnly = true): Promise<Component | null> {
    const rows = (await this.sql`
      SELECT * FROM components
      WHERE id = ${id} AND (${activeOnly ? true : null}::boolean IS NULL OR is_active = true)
      LIMIT 1
    `) as Component[];
    return rows[0] || null;
  }

  async getComponentsByIds(ids: number[], activeOnly = true): Promise<Component[]> {
    if (ids.length === 0) return [];
    const rows = (await this.sql`
      SELECT * FROM components
      WHERE id IN (${ids}) AND (${activeOnly ? true : null}::boolean IS NULL OR is_active = true)
    `) as Component[];
    return rows;
  }

  async getComponentBySlug(slug: string, activeOnly = true): Promise<Component | null> {
    const rows = (await this.sql`
      SELECT * FROM components
      WHERE slug = ${slug} AND (${activeOnly ? true : null}::boolean IS NULL OR is_active = true)
      LIMIT 1
    `) as Component[];
    return rows[0] || null;
  }

  async insertComponent(data: any): Promise<Component> {
    const columns = Object.keys(data);
    const rows = (await this.sql`
      INSERT INTO components ${this.sql(data, ...columns)}
      RETURNING *
    `) as Component[];
    return rows[0];
  }

  async updateComponent(id: number, data: any): Promise<Component | null> {
    const columns = Object.keys(data);
    const rows = (await this.sql`
      UPDATE components SET ${this.sql(data, ...columns)}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `) as Component[];
    return rows[0] || null;
  }

  async deleteComponent(id: number): Promise<boolean> {
    const result = await this.sql`DELETE FROM components WHERE id = ${id} RETURNING id`;
    return result.length > 0;
  }

  async deactivateComponent(id: number): Promise<Component | null> {
    const rows = (await this.sql`
      UPDATE components SET is_active = false, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `) as Component[];
    return rows[0] || null;
  }

  async activateComponent(id: number): Promise<Component | null> {
    const rows = (await this.sql`
      UPDATE components SET is_active = true, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `) as Component[];
    return rows[0] || null;
  }

  async resetSuggestionsForComponent(id: number): Promise<void> {
    await this.sql`
      UPDATE unmatched_suggestions
      SET computed_at = NOW() - INTERVAL '25 hours'
      WHERE existing_component_id = ${id}
    `;
  }

  private normaliseSearchTerm(raw: string): string {
    return raw
      .replace(/[-_./,;:()]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
}
