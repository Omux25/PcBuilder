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
  chipset?: string;
  form_factor?: string;
  interface_type?: string;
  efficiency_rating?: string;
  modular?: string;
  core_count?: number;
  include_inactive?: boolean;
  is_active?: boolean;
  // Compatibility Hints (for sorting)
  compat_socket?: string;
  compat_ram_type?: string;
  compat_form_factors?: string[];
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
    const { 
      compat_socket, compat_ram_type, compat_form_factors 
    } = filters;

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
        filters.chipset ? `chipset = ${this.escape(filters.chipset)}` : null,
        filters.form_factor ? `form_factor = ${this.escape(filters.form_factor)}` : null,
        filters.interface_type ? `interface_type = ${this.escape(filters.interface_type)}` : null,
        filters.efficiency_rating ? `efficiency_rating = ${this.escape(filters.efficiency_rating)}` : null,
        filters.modular ? `modular = ${this.escape(filters.modular)}` : null,
        filters.core_count ? `core_count = ${filters.core_count}` : null,
    ].filter(Boolean) as string[];

    if (search && search.trim() !== '') {
        const tokens = search.toLowerCase().split(' ').filter(Boolean);
        for (const t of tokens) {
            whereClauses.push(`(LOWER(COALESCE(brand, '') || ' ' || name) LIKE ${this.escape('%' + t + '%')})`);
        }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 3. Define Compatibility Prioritization
    const compatParts: string[] = [];
    if (compat_socket) {
        // For CPU/MB: match socket. For Coolers: socket in supported_sockets
        compatParts.push(`(CASE WHEN socket = ${this.escape(compat_socket)} OR ${this.escape(compat_socket)} = ANY(supported_sockets) THEN 1 ELSE 0 END)`);
    }
    if (compat_ram_type) {
        // For RAM: match ram_type. For MB: ram_type in supported_ram_types
        compatParts.push(`(CASE WHEN ram_type = ${this.escape(compat_ram_type)} OR ${this.escape(compat_ram_type)} = ANY(supported_ram_types) THEN 1 ELSE 0 END)`);
    }
    if (compat_form_factors && compat_form_factors.length > 0) {
        const ffList = compat_form_factors.map(f => this.escape(f)).join(', ');
        // For MB: match form_factor. For Cases: form_factor in supported_motherboards
        compatParts.push(`(CASE WHEN form_factor IN (${ffList}) OR EXISTS (SELECT 1 FROM unnest(supported_motherboards) AS sm WHERE sm IN (${ffList})) THEN 1 ELSE 0 END)`);
    }

    const compatSort = compatParts.length > 0 ? `${compatParts.join(' + ')} DESC, ` : '';

    // 4. Define the Order By Logic (CRITICAL: One dir only)
    const validCols = [
        'wattage', 'frequency_mhz', 'core_count', 'thread_count', 'vram_gb', 
        'capacity_gb', 'read_speed_mbps', 'write_speed_mbps', 'height_mm', 
        'max_tdp', 'benchmark_score', 'ram_slots', 'kit_count', 'cas_latency', 
        'tdp', 'length_mm', 'max_gpu_length_mm', 'max_cooler_height_mm',
        'socket', 'chipset', 'form_factor', 'interface_type', 'ram_type',
        'base_clock_ghz', 'boost_clock_ghz', 'airflow_cfm', 'noise_db',
        'pack_size', 'weight_grams', 'thermal_conductivity'
    ];
    
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
        ORDER BY ${compatSort}${orderExpr} NULLS LAST
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

  async getComponentById(id: number, activeOnly = true): Promise<(Component & { lowest_price: number | null; in_stock: boolean }) | null> {
    const rows = await this.sql`
        SELECT 
            c.*,
            (SELECT MIN(price) FROM prices WHERE component_id = c.id AND in_stock = true) as lowest_in_stock,
            (SELECT MIN(price) FROM prices WHERE component_id = c.id) as lowest_any,
            EXISTS (SELECT 1 FROM prices WHERE component_id = c.id AND in_stock = true) as is_in_stock
        FROM components c
        WHERE c.id = ${id} AND (${activeOnly ? true : null}::boolean IS NULL OR c.is_active = true)
        LIMIT 1
    ` as any[];
    
    if (!rows[0]) return null;
    const c = rows[0];
    return {
        ...c,
        lowest_price: Number(c.lowest_in_stock || c.lowest_any) || null,
        in_stock: c.is_in_stock
    };
  }

  async getComponentsByIds(ids: number[], activeOnly = true): Promise<(Component & { lowest_price: number | null; in_stock: boolean })[]> {
    if (ids.length === 0) return [];
    const rows = await this.sql`
        SELECT 
            c.*,
            (SELECT MIN(price) FROM prices WHERE component_id = c.id AND in_stock = true) as lowest_in_stock,
            (SELECT MIN(price) FROM prices WHERE component_id = c.id) as lowest_any,
            EXISTS (SELECT 1 FROM prices WHERE component_id = c.id AND in_stock = true) as is_in_stock
        FROM components c
        WHERE c.id IN (${ids}) AND (${activeOnly ? true : null}::boolean IS NULL OR c.is_active = true)
    ` as any[];
    
    return rows.map(c => ({
        ...c,
        lowest_price: Number(c.lowest_in_stock || c.lowest_any) || null,
        in_stock: c.is_in_stock
    }));
  }

  async getComponentBySlug(slug: string, activeOnly = true): Promise<(Component & { lowest_price: number | null; in_stock: boolean }) | null> {
    const rows = await this.sql`
        SELECT 
            c.*,
            (SELECT MIN(price) FROM prices WHERE component_id = c.id AND in_stock = true) as lowest_in_stock,
            (SELECT MIN(price) FROM prices WHERE component_id = c.id) as lowest_any,
            EXISTS (SELECT 1 FROM prices WHERE component_id = c.id AND in_stock = true) as is_in_stock
        FROM components c
        WHERE c.slug = ${slug} AND (${activeOnly ? true : null}::boolean IS NULL OR c.is_active = true)
        LIMIT 1
    ` as any[];
    
    if (!rows[0]) return null;
    const c = rows[0];
    return {
        ...c,
        lowest_price: Number(c.lowest_in_stock || c.lowest_any) || null,
        in_stock: c.is_in_stock
    };
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
