import { getSql } from '../../../core/db/index.js';
import { Component, ComponentFilters } from '@shared/types';

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

    const params: any[] = [];
    let pIdx = 1;
    const addParam = (val: any) => { params.push(val); return `$${pIdx++}`; };

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
        is_active !== undefined ? `is_active = ${addParam(is_active)}` : null,
        category ? `category = ${addParam(category)}` : null,
        socket ? `socket = ${addParam(socket)}` : null,
        ram_type ? `(ram_type = ${addParam(ram_type)} OR ${addParam(ram_type)} = ANY(supported_ram_types))` : null,
        brand ? `LOWER(brand) = LOWER(${addParam(brand)})` : null,
        vram_gb ? `vram_gb = ${addParam(vram_gb)}` : null,
        min_wattage ? `wattage >= ${addParam(min_wattage)}` : null,
        max_wattage ? `wattage <= ${addParam(max_wattage)}` : null,
        min_capacity_gb ? `capacity_gb >= ${addParam(min_capacity_gb)}` : null,
        max_capacity_gb ? `capacity_gb <= ${addParam(max_capacity_gb)}` : null,
        min_frequency_mhz ? `frequency_mhz >= ${addParam(min_frequency_mhz)}` : null,
        max_frequency_mhz ? `frequency_mhz <= ${addParam(max_frequency_mhz)}` : null,
        filters.chipset ? `chipset = ${addParam(filters.chipset)}` : null,
        filters.form_factor ? `form_factor = ${addParam(filters.form_factor)}` : null,
        filters.interface_type ? `interface_type = ${addParam(filters.interface_type)}` : null,
        filters.efficiency_rating ? `efficiency_rating = ${addParam(filters.efficiency_rating)}` : null,
        filters.modular ? `modular = ${addParam(filters.modular)}` : null,
        filters.core_count ? `core_count = ${addParam(filters.core_count)}` : null,
    ].filter(Boolean) as string[];

    if (search && search.trim() !== '') {
        const tokens = search.toLowerCase().split(' ').filter(Boolean);
        for (const t of tokens) {
            whereClauses.push(`(LOWER(COALESCE(brand, '') || ' ' || name) LIKE ${addParam('%' + t + '%')})`);
        }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Capture the number of parameters used strictly for the WHERE clause
    const whereParamsCount = params.length;

    // 3. Define Compatibility Prioritization
    const compatParts: string[] = [];
    if (compat_socket) {
        if (category === 'cooling') {
            compatParts.push(`(CASE WHEN ${addParam(compat_socket)}::text = ANY(supported_sockets) THEN 1 ELSE 0 END)`);
        } else {
            compatParts.push(`(CASE WHEN socket = ${addParam(compat_socket)}::text THEN 1 ELSE 0 END)`);
        }
    }
    if (compat_ram_type) {
        compatParts.push(`(CASE WHEN ram_type = ${addParam(compat_ram_type)}::text OR ${addParam(compat_ram_type)}::text = ANY(supported_ram_types) THEN 1 ELSE 0 END)`);
    }
    if (compat_form_factors && compat_form_factors.length > 0) {
        // Need to param each array element individually
        const ffParams = compat_form_factors.map(f => `${addParam(f)}::text`).join(', ');
        compatParts.push(`(CASE WHEN form_factor IN (${ffParams}) OR EXISTS (SELECT 1 FROM unnest(supported_motherboards) AS sm WHERE sm IN (${ffParams})) THEN 1 ELSE 0 END)`);
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
        SELECT id, name, category, brand, is_active, image_url, lowest_in_stock, lowest_any, is_in_stock, final_price,
               slug, updated_at, created_at, vram_gb, wattage, capacity_gb, frequency_mhz,
               chipset, form_factor, interface_type, efficiency_rating, modular, core_count, thread_count, ram_slots, socket,
               ram_type, max_tdp, benchmark_score, kit_count, cas_latency, tdp, length_mm, max_gpu_length_mm, max_cooler_height_mm,
               base_clock_ghz, boost_clock_ghz, airflow_cfm, noise_db, pack_size, weight_grams, thermal_conductivity, supported_sockets,
               supported_ram_types, supported_motherboards
        FROM (
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
        LIMIT ${addParam(limit)} OFFSET ${addParam(offset)}
    `;


    const rows = await this.sql.unsafe(finalSql, params) as any[];
    
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
    const total_rows = (await this.sql.unsafe(countSql, params.slice(0, whereParamsCount))) as { cnt: string }[];
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
    const in_stock_rows = (await this.sql.unsafe(inStockCountSql, params.slice(0, whereParamsCount))) as { cnt: string }[];
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

  async createComponent(data: any): Promise<Component> {
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
