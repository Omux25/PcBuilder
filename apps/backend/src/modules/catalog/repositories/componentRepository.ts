import { getSql } from '../../../core/db/index.js';
import type { Component, ComponentFilters } from '@shared/types';

export interface ComponentListResult {
  components: (Component & { lowest_price: number | null; in_stock: boolean })[];
  total: number;
  in_stock_total: number;
}

function getBrandList(brand: any): string[] {
  if (!brand) return [];
  if (Array.isArray(brand)) return brand.map(String).filter(Boolean);
  return String(brand).split(',').map(s => s.trim()).filter(Boolean);
}

function getChipsetList(chipset: any): string[] {
  if (!chipset) return [];
  if (Array.isArray(chipset)) return chipset.map(String).filter(Boolean);
  return String(chipset).split(',').map(s => s.trim()).filter(Boolean);
}

function getVramList(vram: any): number[] {
  if (vram === undefined || vram === null || vram === 0 || vram === '') return [];
  if (Array.isArray(vram)) return vram.map(Number).filter(n => !isNaN(n));
  return String(vram).split(',').map(Number).filter(n => !isNaN(n));
}

function getSocketList(socket: any): string[] {
  if (!socket) return [];
  if (Array.isArray(socket)) return socket.map(String).filter(Boolean);
  return String(socket).split(',').map(s => s.trim()).filter(Boolean);
}

function getRamTypeList(ramType: any): string[] {
  if (!ramType) return [];
  if (Array.isArray(ramType)) return ramType.map(String).filter(Boolean);
  return String(ramType).split(',').map(s => s.trim()).filter(Boolean);
}

function getFormFactorList(formFactor: any): string[] {
  if (!formFactor) return [];
  if (Array.isArray(formFactor)) return formFactor.map(String).filter(Boolean);
  return String(formFactor).split(',').map(s => s.trim()).filter(Boolean);
}

function getInterfaceTypeList(interfaceType: any): string[] {
  if (!interfaceType) return [];
  if (Array.isArray(interfaceType)) return interfaceType.map(String).filter(Boolean);
  return String(interfaceType).split(',').map(s => s.trim()).filter(Boolean);
}

function getEfficiencyRatingList(efficiencyRating: any): string[] {
  if (!efficiencyRating) return [];
  if (Array.isArray(efficiencyRating)) return efficiencyRating.map(String).filter(Boolean);
  return String(efficiencyRating).split(',').map(s => s.trim()).filter(Boolean);
}

function getModularList(modular: any): string[] {
  if (!modular) return [];
  if (Array.isArray(modular)) return modular.map(String).filter(Boolean);
  return String(modular).split(',').map(s => s.trim()).filter(Boolean);
}

export class ComponentRepository {
  private get sql() {
    return getSql();
  }

  async getComponents(filters: ComponentFilters, limit: number, offset: number): Promise<ComponentListResult> {
    console.log("REPOSITORY FILTERS:", JSON.stringify(filters));
    const {
      category, socket, ram_type, brand, search,
      in_stock, is_active,
      min_price, max_price, min_wattage, max_wattage,
      min_capacity_gb, max_capacity_gb, min_frequency_mhz, max_frequency_mhz,
      chipset, form_factor, interface_type, efficiency_rating, modular, core_count,
      vram_gb,
      compat_socket, compat_ram_type, compat_form_factors,
      sort, sortBy, sortOrder
    } = filters;

    // 1. Base filtered components
    let baseQuery = this.sql`
      SELECT 
        c.*,
        COALESCE(c.mpn, c.name || '::' || c.category) as product_key
      FROM components c
      WHERE 1=1
    `;

    if (category) baseQuery = this.sql`${baseQuery} AND c.category = ${category}`;
    
    const socketList = getSocketList(socket);
    if (socketList.length > 0) {
      baseQuery = this.sql`${baseQuery} AND COALESCE(c.socket, c.specs->>'socket') IN ${this.sql(socketList)}`;
    }

    const ramTypeList = getRamTypeList(ram_type);
    if (ramTypeList.length > 0) {
      baseQuery = this.sql`${baseQuery} AND COALESCE(c.ram_type, c.specs->>'ram_type') IN ${this.sql(ramTypeList)}`;
    }
    
    const brandList = getBrandList(brand);
    if (brandList.length > 0) {
      baseQuery = this.sql`${baseQuery} AND c.brand IN ${this.sql(brandList)}`;
    }
    
    if (is_active !== undefined) {
      baseQuery = this.sql`${baseQuery} AND c.is_active = ${is_active}`;
    }

    if (search) {
      const term = `%${search}%`;
      baseQuery = this.sql`${baseQuery} AND (c.name ILIKE ${term} OR c.brand ILIKE ${term} OR c.slug ILIKE ${term} OR c.mpn ILIKE ${term})`;
    }

    if (min_wattage != null) baseQuery = this.sql`${baseQuery} AND COALESCE(c.wattage, (c.specs->>'wattage')::integer) >= ${min_wattage}`;
    if (max_wattage != null) baseQuery = this.sql`${baseQuery} AND COALESCE(c.wattage, (c.specs->>'wattage')::integer) <= ${max_wattage}`;
    if (min_capacity_gb != null) baseQuery = this.sql`${baseQuery} AND COALESCE(c.capacity_gb, (c.specs->>'capacity_gb')::integer) >= ${min_capacity_gb}`;
    if (max_capacity_gb != null) baseQuery = this.sql`${baseQuery} AND COALESCE(c.capacity_gb, (c.specs->>'capacity_gb')::integer) <= ${max_capacity_gb}`;
    if (min_frequency_mhz != null) baseQuery = this.sql`${baseQuery} AND COALESCE(c.frequency_mhz, (c.specs->>'frequency_mhz')::integer) >= ${min_frequency_mhz}`;
    if (max_frequency_mhz != null) baseQuery = this.sql`${baseQuery} AND COALESCE(c.frequency_mhz, (c.specs->>'frequency_mhz')::integer) <= ${max_frequency_mhz}`;
    
    const chipsetList = getChipsetList(chipset);
    if (chipsetList.length > 0) {
      baseQuery = this.sql`${baseQuery} AND COALESCE(c.chipset, c.specs->>'chipset') IN ${this.sql(chipsetList)}`;
    }

    const vramList = getVramList(vram_gb);
    if (vramList.length > 0) {
      baseQuery = this.sql`${baseQuery} AND COALESCE(c.vram_gb, (c.specs->>'vram_gb')::integer) IN ${this.sql(vramList)}`;
    }

    const formFactorList = getFormFactorList(form_factor);
    if (formFactorList.length > 0) {
      baseQuery = this.sql`${baseQuery} AND COALESCE(c.form_factor, c.specs->>'form_factor') IN ${this.sql(formFactorList)}`;
    }

    const interfaceTypeList = getInterfaceTypeList(interface_type);
    if (interfaceTypeList.length > 0) {
      baseQuery = this.sql`${baseQuery} AND COALESCE(c.interface_type, c.specs->>'interface_type') IN ${this.sql(interfaceTypeList)}`;
    }

    const efficiencyRatingList = getEfficiencyRatingList(efficiency_rating);
    if (efficiencyRatingList.length > 0) {
      baseQuery = this.sql`${baseQuery} AND COALESCE(c.efficiency_rating, c.specs->>'efficiency_rating') IN ${this.sql(efficiencyRatingList)}`;
    }

    const modularList = getModularList(modular);
    if (modularList.length > 0) {
      baseQuery = this.sql`${baseQuery} AND COALESCE(c.modular, c.specs->>'modular') IN ${this.sql(modularList)}`;
    }
    if (core_count != null) baseQuery = this.sql`${baseQuery} AND COALESCE(c.core_count, (c.specs->>'core_count')::integer) = ${core_count}`;

    // Compatibility check logic (reused for tiers)
    let isCompatibleSql = this.sql`true`;
    if (compat_socket || compat_ram_type || (compat_form_factors && compat_form_factors.length > 0)) {
      let socketCond = this.sql`true`;
      if (compat_socket) {
        if (category === 'cooling') {
          socketCond = this.sql`(c.specs->'supported_sockets')::jsonb @> jsonb_build_array(${compat_socket})`;
        } else {
          socketCond = this.sql`COALESCE(c.socket, c.specs->>'socket') = ${compat_socket}`;
        }
      }

      let ramCond = this.sql`true`;
      if (compat_ram_type) {
        ramCond = this.sql`COALESCE(c.ram_type, c.specs->>'ram_type') = ${compat_ram_type}`;
      }

      let formCond = this.sql`true`;
      if (compat_form_factors && compat_form_factors.length > 0) {
        if (category === 'case') {
          formCond = this.sql`(c.specs->'supported_motherboards')::jsonb ?| ${(this.sql as any).array(compat_form_factors)}::text[]`;
        } else {
          formCond = this.sql`COALESCE(c.form_factor, c.specs->>'form_factor') IN ${this.sql(compat_form_factors)}`;
        }
      }

      isCompatibleSql = this.sql`(${socketCond}) AND (${ramCond}) AND (${formCond})`;
    }

    const isIncompleteSql = this.sql`
      (
        (c.category = 'gpu' AND (COALESCE(c.vram_gb, (c.specs->>'vram_gb')::integer) IS NULL OR COALESCE(c.chipset, c.specs->>'chipset') IS NULL OR COALESCE(c.length_mm, (c.specs->>'length_mm')::integer) IS NULL)) OR
        (c.category = 'ram' AND (COALESCE(c.capacity_gb, (c.specs->>'capacity_gb')::integer) IS NULL OR COALESCE(c.ram_type, c.specs->>'ram_type') IS NULL OR COALESCE(c.frequency_mhz, (c.specs->>'frequency_mhz')::integer) IS NULL OR COALESCE(c.cas_latency, (c.specs->>'cas_latency')::integer) IS NULL)) OR
        (c.category = 'case' AND (COALESCE(c.form_factor, c.specs->>'form_factor') IS NULL OR COALESCE(c.max_gpu_length_mm, (c.specs->>'max_gpu_length_mm')::integer) IS NULL)) OR
        (c.category = 'psu' AND (COALESCE(c.wattage, (c.specs->>'wattage')::integer) IS NULL OR COALESCE(c.efficiency_rating, c.specs->>'efficiency_rating') IS NULL OR COALESCE(c.modular, c.specs->>'modular') IS NULL)) OR
        (c.category = 'motherboard' AND (COALESCE(c.socket, c.specs->>'socket') IS NULL OR COALESCE(c.chipset, c.specs->>'chipset') IS NULL OR COALESCE(c.form_factor, c.specs->>'form_factor') IS NULL)) OR
        (c.category = 'cpu' AND (COALESCE(c.socket, c.specs->>'socket') IS NULL OR COALESCE(c.core_count, (c.specs->>'core_count')::integer) IS NULL OR COALESCE(c.frequency_mhz, (c.specs->>'frequency_mhz')::integer) IS NULL)) OR
        (c.category = 'storage' AND (COALESCE(c.capacity_gb, (c.specs->>'capacity_gb')::integer) IS NULL OR COALESCE(c.interface_type, c.specs->>'interface_type') IS NULL OR COALESCE(c.form_factor, c.specs->>'form_factor') IS NULL)) OR
        (c.category = 'cooling' AND ((c.specs->'supported_sockets')::jsonb IS NULL OR COALESCE(c.height_mm, (c.specs->>'height_mm')::integer) IS NULL OR COALESCE(c.tdp, (c.specs->>'tdp')::integer) IS NULL))
      )
    `;

    // 2. Full Aggregated Query
    let query = this.sql`
      WITH filtered_components AS (
        ${baseQuery}
      ),
      all_matching_components AS (
        -- Get all components with the same product_key as the filtered ones
        -- to ensure we aggregate prices from ALL retailers, even if only one retailer
        -- matched specific filters (like search)
        SELECT 
          id, 
          COALESCE(mpn, name || '::' || category) as product_key
        FROM components
        WHERE COALESCE(mpn, name || '::' || category) IN (SELECT product_key FROM filtered_components)
      ),
      aggregated_prices AS (
        SELECT 
          amc.product_key,
          MIN(p.price) FILTER (WHERE p.in_stock = true) as lowest_in_stock,
          MIN(p.price) as lowest_any,
          bool_or(p.in_stock) as in_stock,
          COUNT(DISTINCT p.retailer_id) as total_offers,
          json_agg(
            json_build_object(
              'retailer_name', r.name,
              'price', p.price,
              'in_stock', p.in_stock,
              'product_url', p.product_url
            ) ORDER BY p.price ASC
          ) as offers
        FROM all_matching_components amc
        JOIN prices p ON p.component_id = amc.id
        JOIN retailers r ON r.id = p.retailer_id
        GROUP BY amc.product_key
      )
      SELECT 
        c.*,
        COALESCE(ap.lowest_in_stock, ap.lowest_any) as lowest_price,
        COALESCE(ap.lowest_in_stock, ap.lowest_any) as primary_price,
        COALESCE(ap.in_stock, false) as in_stock,
        COALESCE(ap.total_offers, 0) as total_offers,
        COALESCE(ap.offers, '[]'::json) as offers
      FROM (
        SELECT DISTINCT ON (product_key) * FROM filtered_components
        ORDER BY product_key, id ASC
      ) c
      LEFT JOIN aggregated_prices ap ON ap.product_key = c.product_key
      WHERE 1=1
    `;

    if (in_stock) query = this.sql`${query} AND COALESCE(ap.in_stock, false) = true`;
    if (min_price != null) query = this.sql`${query} AND COALESCE(ap.lowest_in_stock, ap.lowest_any) >= ${min_price}`;
    if (max_price != null) query = this.sql`${query} AND COALESCE(ap.lowest_in_stock, ap.lowest_any) <= ${max_price}`;

    // Get total count
    const countResult = await this.sql`SELECT COUNT(*) FROM (${query}) as sub` as { count: string }[];
    const total = parseInt(countResult[0].count, 10);

    // Get in-stock count
    const inStockResult = await this.sql`SELECT COUNT(*) FROM (${query}) as sub WHERE in_stock = true` as { count: string }[];
    const inStockTotal = parseInt(inStockResult[0].count, 10);

    const tierCase = this.sql`
      CASE 
        -- Tier 6 (The Graveyard): Ghost Components
        WHEN (COALESCE(ap.lowest_in_stock, ap.lowest_any) IS NULL OR COALESCE(ap.lowest_in_stock, ap.lowest_any) <= 0) THEN 6
        
        -- Tier 5: Incompatible
        WHEN NOT (${isCompatibleSql}) THEN 5
        
        -- Tier 1: Compatible & In Stock & Complete
        WHEN (COALESCE(ap.in_stock, false) = true AND COALESCE(ap.lowest_in_stock, ap.lowest_any) > 0 AND NOT ${isIncompleteSql}) THEN 1
        
        -- Tier 2: Compatible & In Stock & Incomplete
        WHEN (COALESCE(ap.in_stock, false) = true AND COALESCE(ap.lowest_in_stock, ap.lowest_any) > 0 AND ${isIncompleteSql}) THEN 2
        
        -- Tier 3: Compatible & Out of Stock & Complete
        WHEN (COALESCE(ap.in_stock, false) = false AND COALESCE(ap.lowest_in_stock, ap.lowest_any) > 0 AND NOT ${isIncompleteSql}) THEN 3
        
        -- Tier 4: Compatible & Out of Stock & Incomplete
        WHEN (COALESCE(ap.in_stock, false) = false AND COALESCE(ap.lowest_in_stock, ap.lowest_any) > 0 AND ${isIncompleteSql}) THEN 4
        
        ELSE 6
      END
    `;

    // Apply sorting
    let orderBy = this.sql`
      ${tierCase} ASC,
      CASE 
        WHEN COALESCE(ap.in_stock, false) = true AND ap.lowest_in_stock > 0 THEN ap.lowest_in_stock
        WHEN COALESCE(ap.in_stock, false) = false AND ap.lowest_any > 0 THEN ap.lowest_any
        ELSE NULL
      END ASC,
      c.id DESC
    `;

    if (sortBy) {
      const dir = (sortOrder === 'desc' || sortOrder === 'DESC' || sortOrder === 'descending') ? this.sql`DESC` : this.sql`ASC`;
      
      const promotedColumns = [
        'vram_gb', 'length_mm', 'tdp', 'wattage', 'capacity_gb', 'frequency_mhz', 
        'core_count', 'thread_count', 'read_speed_mbps', 'write_speed_mbps', 
        'ram_slots', 'm2_slots', 'sata_ports', 'max_cooler_height_mm', 'height_mm', 
        'max_tdp', 'kit_count', 'cas_latency', 'size_mm', 'airflow_cfm', 'noise_db', 
        'pack_size', 'weight_grams', 'thermal_conductivity', 'base_clock_ghz', 'boost_clock_ghz',
        'socket', 'ram_type', 'form_factor', 'interface_type'
      ];

      if (promotedColumns.includes(sortBy)) {
        orderBy = this.sql`c.${this.sql(sortBy)} ${dir} NULLS LAST, c.id DESC`;
      } else if (sortBy === 'efficiency_rating') {
        // Use CASE WHEN ILIKE for robust matching regardless of exact formatting variants
        orderBy = this.sql`
          CASE
            WHEN c.efficiency_rating ILIKE '%titanium%' THEN 7
            WHEN c.efficiency_rating ILIKE '%platinum%' THEN 6
            WHEN c.efficiency_rating ILIKE '%gold%' THEN 5
            WHEN c.efficiency_rating ILIKE '%silver%' THEN 4
            WHEN c.efficiency_rating ILIKE '%bronze%' THEN 3
            WHEN c.efficiency_rating ILIKE '%white%' THEN 2
            WHEN c.efficiency_rating = '80+' OR c.efficiency_rating ILIKE '%80 plus%' OR c.efficiency_rating ILIKE '%80plus%' THEN 1
            ELSE NULL
          END ${dir} NULLS LAST,
          c.id DESC
        `;
      } else if (sortBy === 'modular') {
        // Use CASE WHEN ILIKE for robust matching regardless of exact value variants
        orderBy = this.sql`
          CASE
            WHEN c.modular ILIKE '%full%' OR c.modular = 'Fully' OR c.modular = 'Modulaire' THEN 3
            WHEN c.modular ILIKE '%semi%' THEN 2
            WHEN c.modular ILIKE '%non%' OR c.modular ILIKE '%none%' THEN 1
            ELSE NULL
          END ${dir} NULLS LAST,
          c.id DESC
        `;
      } else if (sortBy === 'chipset') {
        const chipsetRanking = [
          'RTX 5090', 'RTX 5080', 'RTX 5070 Ti', 'RTX 5070', 'RTX 5060 Ti', 'RTX 5060', 'RTX 5050',
          'RTX 6000 Ada Generation', 'RTX 6000 Ada', 'RTX 4090', 'RTX 5000 Ada Generation', 'RTX 5000 Ada', 'RTX 4080 Super', 'RTX 4080', 'RTX 4500 Ada Generation', 'RTX 4500 Ada', 'RTX 4070 Ti Super', 'RTX 4070 Ti', 'RTX 4000 Ada Generation', 'RTX 4000 Ada', 'RTX 4070 Super', 'RTX 4070', 'RTX 4060 Ti', 'RTX 4060',
          'RX 7900 XTX', 'RX 7900 XT', 'RX 7900 GRE', 'RX 7800 XT', 'RX 7700 XT', 'RX 7600 XT', 'RX 7600',
          'RTX A6000', 'RTX 3090 Ti', 'RTX 3090', 'RTX A5500', 'RTX 3080 Ti', 'RTX 3080', 'RTX A5000', 'RTX 3070 Ti', 'RTX 3070', 'RTX A4500', 'RTX A4000', 'RTX 3060 Ti', 'RTX 3060', 'RTX 3050',
          'RX 6950 XT', 'RX 6900 XT', 'RX 6800 XT', 'RX 6800', 'RX 6750 XT', 'RX 6700 XT', 'RX 6700', 'RX 6650 XT', 'RX 6600 XT', 'RX 6600', 'RX 6500 XT', 'RX 6400',
          'Arc A770', 'Arc A750', 'Arc A580', 'Arc A380',
          'RTX 2080 Ti', 'RTX 2080 Super', 'RTX 2080', 'RTX 2070 Super', 'RTX 2070', 'RTX 2060 Super', 'RTX 2060',
          'RX 5700 XT', 'RX 5700', 'RX 5600 XT', 'RX 5500 XT',
          'GTX 1660 Ti', 'GTX 1660 Super', 'GTX 1660', 'GTX 1650 Super', 'GTX 1650', 'GTX 1630',
          'GTX 1080 Ti', 'GTX 1080', 'GTX 1070 Ti', 'GTX 1070', 'GTX 1060 6GB', 'GTX 1060 3GB', 'GTX 1050 Ti', 'GTX 1050'
        ];
        
        const arrayStr = `ARRAY[${chipsetRanking.reverse().map(c => `'${c.toUpperCase()}'`).join(', ')}]::varchar[]`;
        orderBy = this.sql`array_position(${this.sql.unsafe(arrayStr)}, UPPER(c.chipset)) ${dir} NULLS LAST, c.id DESC`;
      } else if (sortBy === 'price') {
        orderBy = this.sql`
          CASE
            WHEN COALESCE(ap.in_stock, false) = true AND ap.lowest_in_stock > 0 THEN ap.lowest_in_stock
            WHEN COALESCE(ap.in_stock, false) = false AND ap.lowest_any > 0 THEN ap.lowest_any
            ELSE NULL
          END ${dir} NULLS LAST,
          c.id DESC
        `;
      } else if (sortBy === 'name') {
        orderBy = this.sql`c.name ${dir}, c.id DESC`;
      } else if (sortBy === 'price_per_gb') {
        orderBy = this.sql`
          (
            COALESCE(ap.lowest_in_stock, ap.lowest_any) /
            NULLIF(COALESCE(c.capacity_gb, (c.specs->>'capacity_gb')::integer), 0)
          ) ${dir} NULLS LAST,
          c.id DESC
        `;
      } else {
        orderBy = this.sql`(c.specs->>${this.sql(sortBy)})::integer ${dir} NULLS LAST, c.id DESC`;
      }    } else if (sort) {
      const [field, direction] = sort.split('_');
      const dir = direction === 'asc' ? this.sql`ASC` : this.sql`DESC`;
      
      if (field === 'price') {
        orderBy = this.sql`
          ${tierCase} ASC,
          CASE 
            WHEN COALESCE(ap.in_stock, false) = true AND ap.lowest_in_stock > 0 THEN ap.lowest_in_stock
            WHEN COALESCE(ap.in_stock, false) = false AND ap.lowest_any > 0 THEN ap.lowest_any
            ELSE NULL
          END ${dir},
          c.id DESC
        `;
      } else if (field === 'name') {
        orderBy = this.sql`c.name ${dir}, c.id DESC`;
      } else if (field === 'score') {
        orderBy = this.sql`c.benchmark_score ${dir} NULLS LAST, c.id DESC`;
      } else if (['wattage', 'tdp', 'vram_gb', 'capacity_gb', 'frequency_mhz', 'core_count', 'length_mm'].includes(field)) {
        orderBy = this.sql`(c.specs->>${this.sql(field)})::integer ${dir} NULLS LAST, c.id DESC`;
      }
    }

    const finalQuery = this.sql`${query} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`;
    const components = (await finalQuery as any[]).map((row: any) => ({
      ...row,
      lowest_price: row.lowest_price ? Number(row.lowest_price) : null,
      primary_price: row.primary_price ? Number(row.primary_price) : null,
      total_offers: Number(row.total_offers)
    })) as (Component & { lowest_price: number | null; in_stock: boolean })[];

    return { components, total, in_stock_total: inStockTotal };
  }

  async getComponentsByIds(ids: number[]): Promise<Component[]> {
    if (ids.length === 0) return [];
    const rows = (await this.sql`
      SELECT 
        c.*, 
        COALESCE(ap.lowest_in_stock, ap.lowest_any) as lowest_price,
        COALESCE(ap.lowest_in_stock, ap.lowest_any) as primary_price,
        COALESCE(ap.in_stock, false) as in_stock,
        COALESCE(ap.total_offers, 0) as total_offers,
        COALESCE(ap.offers, '[]'::json) as offers
      FROM components c
      LEFT JOIN (
        SELECT 
          COALESCE(c2.mpn, c2.name || '::' || c2.category) as product_key,
          MIN(p.price) FILTER (WHERE p.in_stock = true) as lowest_in_stock,
          MIN(p.price) as lowest_any,
          bool_or(p.in_stock) as in_stock,
          COUNT(DISTINCT p.retailer_id) as total_offers,
          json_agg(
            json_build_object(
              'retailer_name', r.name,
              'price', p.price,
              'in_stock', p.in_stock,
              'product_url', p.product_url
            ) ORDER BY p.price ASC
          ) as offers
        FROM components c2
        JOIN prices p ON p.component_id = c2.id
        JOIN retailers r ON r.id = p.retailer_id
        GROUP BY product_key
      ) ap ON ap.product_key = COALESCE(c.mpn, c.name || '::' || c.category)
      WHERE c.id IN ${this.sql(ids)}
    `) as any[];
    return rows.map((row: any) => ({
      ...row,
      lowest_price: row.lowest_price ? Number(row.lowest_price) : null,
      primary_price: row.primary_price ? Number(row.primary_price) : null,
      total_offers: Number(row.total_offers)
    })) as Component[];
  }

  async getComponentBySlug(slug: string): Promise<Component | null> {
    const rows = (await this.sql`
      SELECT 
        c.*, 
        COALESCE(ap.lowest_in_stock, ap.lowest_any) as lowest_price,
        COALESCE(ap.lowest_in_stock, ap.lowest_any) as primary_price,
        COALESCE(ap.in_stock, false) as in_stock,
        COALESCE(ap.total_offers, 0) as total_offers,
        COALESCE(ap.offers, '[]'::json) as offers
      FROM components c
      LEFT JOIN (
        SELECT 
          COALESCE(c2.mpn, c2.name || '::' || c2.category) as product_key,
          MIN(p.price) FILTER (WHERE p.in_stock = true) as lowest_in_stock,
          MIN(p.price) as lowest_any,
          bool_or(p.in_stock) as in_stock,
          COUNT(DISTINCT p.retailer_id) as total_offers,
          json_agg(
            json_build_object(
              'retailer_name', r.name,
              'price', p.price,
              'in_stock', p.in_stock,
              'product_url', p.product_url
            ) ORDER BY p.price ASC
          ) as offers
        FROM components c2
        JOIN prices p ON p.component_id = c2.id
        JOIN retailers r ON r.id = p.retailer_id
        GROUP BY product_key
      ) ap ON ap.product_key = COALESCE(c.mpn, c.name || '::' || c.category)
      WHERE c.slug = ${slug}
      LIMIT 1
    `) as any[];
    if (rows.length === 0) return null;
    return {
      ...rows[0],
      lowest_price: rows[0].lowest_price ? Number(rows[0].lowest_price) : null,
      primary_price: rows[0].primary_price ? Number(rows[0].primary_price) : null,
      total_offers: Number(rows[0].total_offers)
    } as Component;
  }

  async getComponentById(id: number, _activeOnly: boolean = true): Promise<Component | null> {
    const rows = (await this.sql`
      SELECT 
        c.*, 
        COALESCE(ap.lowest_in_stock, ap.lowest_any) as lowest_price,
        COALESCE(ap.lowest_in_stock, ap.lowest_any) as primary_price,
        COALESCE(ap.in_stock, false) as in_stock,
        COALESCE(ap.total_offers, 0) as total_offers,
        COALESCE(ap.offers, '[]'::json) as offers
      FROM components c
      LEFT JOIN (
        SELECT 
          COALESCE(c2.mpn, c2.name || '::' || c2.category) as product_key,
          MIN(p.price) FILTER (WHERE p.in_stock = true) as lowest_in_stock,
          MIN(p.price) as lowest_any,
          bool_or(p.in_stock) as in_stock,
          COUNT(DISTINCT p.retailer_id) as total_offers,
          json_agg(
            json_build_object(
              'retailer_name', r.name,
              'price', p.price,
              'in_stock', p.in_stock,
              'product_url', p.product_url
            ) ORDER BY p.price ASC
          ) as offers
        FROM components c2
        JOIN prices p ON p.component_id = c2.id
        JOIN retailers r ON r.id = p.retailer_id
        GROUP BY product_key
      ) ap ON ap.product_key = COALESCE(c.mpn, c.name || '::' || c.category)
      WHERE c.id = ${id}
      LIMIT 1
    `) as any[];
    if (rows.length === 0) return null;
    return {
      ...rows[0],
      lowest_price: rows[0].lowest_price ? Number(rows[0].lowest_price) : null,
      primary_price: rows[0].primary_price ? Number(rows[0].primary_price) : null,
      total_offers: Number(rows[0].total_offers)
    } as Component;
  }

  async getComponentByIdentifier(category: string, identifier: string): Promise<Component | null> {
    const isId = /^\d+$/.test(identifier);
    let rows = (await this.sql`
      SELECT 
        c.*, 
        COALESCE(ap.lowest_in_stock, ap.lowest_any) as lowest_price,
        COALESCE(ap.lowest_in_stock, ap.lowest_any) as primary_price,
        COALESCE(ap.in_stock, false) as in_stock,
        COALESCE(ap.total_offers, 0) as total_offers,
        COALESCE(ap.offers, '[]'::json) as offers
      FROM components c
      LEFT JOIN (
        SELECT 
          COALESCE(c2.mpn, c2.name || '::' || c2.category) as product_key,
          MIN(p.price) FILTER (WHERE p.in_stock = true) as lowest_in_stock,
          MIN(p.price) as lowest_any,
          bool_or(p.in_stock) as in_stock,
          COUNT(DISTINCT p.retailer_id) as total_offers,
          json_agg(
            json_build_object(
              'retailer_name', r.name,
              'price', p.price,
              'in_stock', p.in_stock,
              'product_url', p.product_url
            ) ORDER BY p.price ASC
          ) as offers
        FROM components c2
        JOIN prices p ON p.component_id = c2.id
        JOIN retailers r ON r.id = p.retailer_id
        GROUP BY product_key
      ) ap ON ap.product_key = COALESCE(c.mpn, c.name || '::' || c.category)
      WHERE c.category = ${category} 
        AND (
          (${isId}::boolean = true AND c.id = ${isId ? Number(identifier) : 0}) OR 
          (${isId}::boolean = false AND c.mpn = ${identifier})
        )
      ORDER BY c.id ASC
      LIMIT 1
    `) as any[];

    if (rows.length === 0) return null;
    return {
      ...rows[0],
      lowest_price: rows[0].lowest_price ? Number(rows[0].lowest_price) : null,
      primary_price: rows[0].primary_price ? Number(rows[0].primary_price) : null,
      total_offers: Number(rows[0].total_offers)
    } as Component;
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

  private getFilterExcept(category: string, activeFilters: ComponentFilters | undefined, excludeKey?: string) {
    let conditions = this.sql`c.category = ${category} AND c.is_active = true`;

    if (activeFilters) {
      const {
        brand, socket, chipset, form_factor, vram_gb, ram_type, search,
        compat_socket, compat_ram_type, compat_form_factors
      } = activeFilters;

      const brandList = getBrandList(brand);
      if (excludeKey !== 'brand' && brandList.length > 0) {
        conditions = this.sql`${conditions} AND c.brand IN ${this.sql(brandList)}`;
      }
      const socketList = getSocketList(socket);
      if (excludeKey !== 'socket' && socketList.length > 0) {
        conditions = this.sql`${conditions} AND COALESCE(c.socket, c.specs->>'socket') IN ${this.sql(socketList)}`;
      }
      const chipsetList = getChipsetList(chipset);
      if (excludeKey !== 'chipset' && chipsetList.length > 0) {
        conditions = this.sql`${conditions} AND COALESCE(c.chipset, c.specs->>'chipset') IN ${this.sql(chipsetList)}`;
      }
      const formFactorList = getFormFactorList(form_factor);
      if (excludeKey !== 'form_factor' && formFactorList.length > 0) {
        conditions = this.sql`${conditions} AND COALESCE(c.form_factor, c.specs->>'form_factor') IN ${this.sql(formFactorList)}`;
      }
      const vramList = getVramList(vram_gb);
      if (excludeKey !== 'vram' && vramList.length > 0) {
        conditions = this.sql`${conditions} AND COALESCE(c.vram_gb, (c.specs->>'vram_gb')::integer) IN ${this.sql(vramList)}`;
      }
      const ramTypeList = getRamTypeList(ram_type);
      if (excludeKey !== 'ram_type' && ramTypeList.length > 0) {
        conditions = this.sql`${conditions} AND COALESCE(c.ram_type, c.specs->>'ram_type') IN ${this.sql(ramTypeList)}`;
      }
      if (search) {
        const term = `%${search}%`;
        conditions = this.sql`${conditions} AND (c.name ILIKE ${term} OR c.brand ILIKE ${term} OR c.slug ILIKE ${term})`;
      }

      // Compatibility hints (strict filters when compatibleOnly is active)
      if (compat_socket) {
        if (category === 'cooling') {
          conditions = this.sql`${conditions} AND (c.specs->'supported_sockets')::jsonb @> jsonb_build_array(${compat_socket})`;
        } else if (excludeKey !== 'socket') {
          conditions = this.sql`${conditions} AND COALESCE(c.socket, c.specs->>'socket') = ${compat_socket}`;
        }
      }
      if (compat_ram_type) {
        conditions = this.sql`${conditions} AND COALESCE(c.ram_type, c.specs->>'ram_type') = ${compat_ram_type}`;
      }
      if (compat_form_factors && compat_form_factors.length > 0) {
        if (category === 'case') {
          conditions = this.sql`${conditions} AND (c.specs->'supported_motherboards')::jsonb ?| ${(this.sql as any).array(compat_form_factors)}::text[]`;
        } else if (excludeKey !== 'form_factor') {
          conditions = this.sql`${conditions} AND COALESCE(c.form_factor, c.specs->>'form_factor') IN ${this.sql(compat_form_factors)}`;
        }
      }
    }

    return conditions;
  }

  async getFacets(category: string, activeFilters?: ComponentFilters): Promise<{ brands: string[], sockets: string[], chipsets: string[], form_factors: string[], vrams: number[] }> {
    const brandCond = this.getFilterExcept(category, activeFilters, 'brand');
    const socketCond = this.getFilterExcept(category, activeFilters, 'socket');
    const chipsetCond = this.getFilterExcept(category, activeFilters, 'chipset');
    const formFactorCond = this.getFilterExcept(category, activeFilters, 'form_factor');
    const vramCond = this.getFilterExcept(category, activeFilters, 'vram');

    const rows = await this.sql`
      SELECT 
        (SELECT array_agg(DISTINCT brand) FROM components c WHERE ${brandCond} AND brand IS NOT NULL) as brands,
        (SELECT array_agg(DISTINCT COALESCE(socket, specs->>'socket')) FROM components c WHERE ${socketCond} AND COALESCE(socket, specs->>'socket') IS NOT NULL) as sockets,
        (SELECT array_agg(DISTINCT COALESCE(chipset, specs->>'chipset')) FROM components c WHERE ${chipsetCond} AND COALESCE(chipset, specs->>'chipset') IS NOT NULL) as chipsets,
        (SELECT array_agg(DISTINCT COALESCE(form_factor, specs->>'form_factor')) FROM components c WHERE ${formFactorCond} AND COALESCE(form_factor, specs->>'form_factor') IS NOT NULL) as form_factors,
        (SELECT array_agg(DISTINCT COALESCE(vram_gb, (specs->>'vram_gb')::integer)) FROM components c WHERE ${vramCond} AND COALESCE(vram_gb, (specs->>'vram_gb')::integer) IS NOT NULL) as vrams
    ` as any[];

    if (rows.length === 0) {
      return { brands: [], sockets: [], chipsets: [], form_factors: [], vrams: [] };
    }

    const row = rows[0];
    const filterEmpty = (arr: any[]) => 
      arr ? arr.filter((x: any) => x !== null && x !== undefined && String(x).trim() !== '') : [];

    return {
      brands: filterEmpty(row.brands).sort(),
      sockets: filterEmpty(row.sockets).sort(),
      chipsets: filterEmpty(row.chipsets).sort(),
      form_factors: filterEmpty(row.form_factors).sort(),
      vrams: row.vrams ? [...row.vrams].filter((x: any) => x !== null && x !== undefined).sort((a: number, b: number) => a - b) : [],
    };
  }
}

