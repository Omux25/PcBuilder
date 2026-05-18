import { getSql } from '../../../core/db/index.js';
import type { Component, ComponentFilters } from '@shared/types';

export interface ComponentListResult {
  components: (Component & { lowest_price: number | null; in_stock: boolean })[];
  total: number;
  in_stock_total: number;
}

export class ComponentRepository {
  private sql = getSql();

  async getComponents(filters: ComponentFilters, limit: number, offset: number): Promise<ComponentListResult> {
    const {
      category, socket, ram_type, brand, search,
      in_stock, is_active,
      min_price, max_price, min_wattage, max_wattage,
      min_capacity_gb, max_capacity_gb, min_frequency_mhz, max_frequency_mhz,
      chipset, form_factor, interface_type, efficiency_rating, modular, core_count,
      compat_socket, compat_ram_type, compat_form_factors
    } = filters;

    // Base query for components with their lowest prices
    let query = this.sql`
      WITH lowest_prices AS (
        SELECT 
          component_id, 
          MIN(price) FILTER (WHERE in_stock = true) as lowest_in_stock,
          MIN(price) as lowest_any,
          bool_or(in_stock) as in_stock
        FROM prices
        GROUP BY component_id
      )
      SELECT 
        c.*, 
        lp.lowest_in_stock as lowest_price,
        COALESCE(lp.in_stock, false) as in_stock
      FROM components c
      LEFT JOIN lowest_prices lp ON lp.component_id = c.id
      WHERE 1=1
    `;

    if (category) query = this.sql`${query} AND c.category = ${category}`;
    if (socket) query = this.sql`${query} AND c.socket = ${socket}`;
    if (ram_type) query = this.sql`${query} AND c.ram_type = ${ram_type}`;
    if (brand) query = this.sql`${query} AND c.brand = ${brand}`;
    
    if (is_active !== undefined) {
      query = this.sql`${query} AND c.is_active = ${is_active}`;
    }

    if (search) {
      const term = `%${search}%`;
      query = this.sql`${query} AND (c.name ILIKE ${term} OR c.brand ILIKE ${term} OR c.slug ILIKE ${term})`;
    }

    if (in_stock) query = this.sql`${query} AND lp.in_stock = true`;
    
    // Numeric Filters
    if (min_price != null) query = this.sql`${query} AND lp.lowest_in_stock >= ${min_price}`;
    if (max_price != null) query = this.sql`${query} AND lp.lowest_in_stock <= ${max_price}`;
    if (min_wattage != null) query = this.sql`${query} AND c.wattage >= ${min_wattage}`;
    if (max_wattage != null) query = this.sql`${query} AND c.wattage <= ${max_wattage}`;
    if (min_capacity_gb != null) query = this.sql`${query} AND c.capacity_gb >= ${min_capacity_gb}`;
    if (max_capacity_gb != null) query = this.sql`${query} AND c.capacity_gb <= ${max_capacity_gb}`;
    if (min_frequency_mhz != null) query = this.sql`${query} AND c.frequency_mhz >= ${min_frequency_mhz}`;
    if (max_frequency_mhz != null) query = this.sql`${query} AND c.frequency_mhz <= ${max_frequency_mhz}`;
    
    // String Specs
    if (chipset) query = this.sql`${query} AND c.chipset = ${chipset}`;
    if (form_factor) query = this.sql`${query} AND c.form_factor = ${form_factor}`;
    if (interface_type) query = this.sql`${query} AND c.interface_type = ${interface_type}`;
    if (efficiency_rating) query = this.sql`${query} AND c.efficiency_rating = ${efficiency_rating}`;
    if (modular) query = this.sql`${query} AND c.modular = ${modular}`;
    if (core_count != null) query = this.sql`${query} AND c.core_count = ${core_count}`;

    // Compatibility Hints
    if (compat_socket) {
      if (category === 'cooling') {
        query = this.sql`${query} AND c.supported_sockets @> ARRAY[${compat_socket}]::varchar[]`;
      } else {
        query = this.sql`${query} AND c.socket = ${compat_socket}`;
      }
    }
    if (compat_ram_type) query = this.sql`${query} AND c.ram_type = ${compat_ram_type}`;
    if (compat_form_factors && compat_form_factors.length > 0) {
      if (category === 'case') {
        query = this.sql`${query} AND c.supported_motherboards && ARRAY[${this.sql(compat_form_factors)}]::varchar[]`;
      } else {
        query = this.sql`${query} AND c.form_factor IN ${this.sql(compat_form_factors)}`;
      }
    }

    // Get total count
    const countResult = await this.sql`SELECT COUNT(*) FROM (${query}) as sub` as { count: string }[];
    const total = parseInt(countResult[0].count, 10);

    // Get in-stock count
    const inStockResult = await this.sql`SELECT COUNT(*) FROM (${query}) as sub WHERE in_stock = true` as { count: string }[];
    const inStockTotal = parseInt(inStockResult[0].count, 10);

    // Apply sorting, limit, and offset
    const finalQuery = this.sql`${query} ORDER BY c.id DESC LIMIT ${limit} OFFSET ${offset}`;
    const components = await finalQuery as (Component & { lowest_price: number | null; in_stock: boolean })[];

    return { components, total, in_stock_total: inStockTotal };
  }

  async getComponentsByIds(ids: number[]): Promise<Component[]> {
    if (ids.length === 0) return [];
    return await this.sql`
      SELECT c.*, lp.lowest_in_stock as lowest_price, COALESCE(lp.in_stock, false) as in_stock
      FROM components c
      LEFT JOIN (
        SELECT component_id, MIN(price) as lowest_in_stock, bool_or(in_stock) as in_stock
        FROM prices WHERE in_stock = true GROUP BY component_id
      ) lp ON lp.component_id = c.id
      WHERE c.id IN ${this.sql(ids)}
    ` as Component[];
  }

  async getComponentBySlug(slug: string): Promise<Component | null> {
    const rows = await this.sql`
      SELECT c.*, lp.lowest_in_stock as lowest_price, COALESCE(lp.in_stock, false) as in_stock
      FROM components c
      LEFT JOIN (
        SELECT component_id, MIN(price) as lowest_in_stock, bool_or(in_stock) as in_stock
        FROM prices WHERE in_stock = true GROUP BY component_id
      ) lp ON lp.component_id = c.id
      WHERE c.slug = ${slug}
      LIMIT 1
    ` as Component[];
    return rows[0] || null;
  }

  async getComponentById(id: number, _activeOnly: boolean = true): Promise<Component | null> {
    const rows = await this.sql`
      SELECT c.*, lp.lowest_in_stock as lowest_price, COALESCE(lp.in_stock, false) as in_stock
      FROM components c
      LEFT JOIN (
        SELECT component_id, MIN(price) as lowest_in_stock, bool_or(in_stock) as in_stock
        FROM prices WHERE in_stock = true GROUP BY component_id
      ) lp ON lp.component_id = c.id
      WHERE c.id = ${id}
      LIMIT 1
    ` as Component[];
    return rows[0] || null;
  }

  async createComponent(data: any): Promise<Component> {
    const rows = await this.sql`
      INSERT INTO components ${this.sql(data)}
      RETURNING *
    ` as Component[];
    return rows[0];
  }

  async updateComponent(id: number, data: any): Promise<Component> {
    const rows = await this.sql`
      UPDATE components 
      SET ${this.sql(data)}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    ` as Component[];
    return rows[0] || null;
  }

  async deleteComponent(id: number): Promise<void> {
    await this.sql`DELETE FROM components WHERE id = ${id}`;
  }

  async deactivateComponent(id: number): Promise<Component | null> {
    const rows = await this.sql`
      UPDATE components SET is_active = false, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    ` as Component[];
    return rows[0] || null;
  }

  async activateComponent(id: number): Promise<Component | null> {
    const rows = await this.sql`
      UPDATE components SET is_active = true, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    ` as Component[];
    return rows[0] || null;
  }

  async resetSuggestionsForComponent(id: number): Promise<void> {
    await this.sql`DELETE FROM unmatched_suggestions WHERE existing_component_id = ${id}`;
  }
}
