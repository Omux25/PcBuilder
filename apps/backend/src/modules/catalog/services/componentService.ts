import { ComponentRepository, ComponentFilters } from '../repositories/componentRepository.js';
import { PriceRepository } from '../repositories/priceRepository.js';
import { generateUniqueSlug as getUniqueSlug } from '../../../core/utils/slugify.js';
import { AppError } from '../../../core/errors/errors.js';

import { Component, PriceOffer, ComponentInput } from '@shared/types';
import { validateCompatibility } from '../../builds/services/compatibilityService.js';
import { getSql } from '../../../core/db/index.js';
import { getPriceHistory } from './priceHistoryService.js';

export interface ComponentListResult {
  components: Component[];
  total: number;
  in_stock_total?: number;
}

export class ComponentService {
  private repository = new ComponentRepository();
  private priceRepository = new PriceRepository();

  async getComponents(filters: ComponentFilters & { page?: number; limit?: number } = {}): Promise<ComponentListResult> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(1000, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    return this.repository.getComponents(filters, limit, offset);
  }

  async getComponentById(id: number): Promise<Component> {
    const component = await this.repository.getComponentById(id);
    if (!component) {
      throw new AppError('COMPONENT_NOT_FOUND', `Component with id ${id} not found`, 404);
    }
    return component;
  }

  async getComponentsByIds(ids: number[]): Promise<Component[]> {
    return this.repository.getComponentsByIds(ids);
  }

  async getComponentBySlug(slug: string): Promise<Component> {
    const component = await this.repository.getComponentBySlug(slug);
    if (!component) {
      throw new AppError('COMPONENT_NOT_FOUND', `Component "${slug}" not found`, 404);
    }
    return component;
  }

  async getPricesByComponentId(id: number): Promise<PriceOffer[]> {
    return this.priceRepository.getPricesByComponentId(id);
  }

  async getPriceHistory(id: number, days: number = 30): Promise<any[]> {
    return getPriceHistory(id, undefined, days);
  }

  async smartSearch(params: {
    category: string;
    search?: string;
    brand?: string;
    socket?: string;
    ram_type?: string;
    sort?: string;
    minPrice?: number | null;
    maxPrice?: number | null;
    min_wattage?: number | null;
    max_wattage?: number | null;
    min_capacity_gb?: number | null;
    max_capacity_gb?: number | null;
    min_frequency_mhz?: number | null;
    max_frequency_mhz?: number | null;
    inStockOnly?: boolean;
    vramGb?: number;
    page: number;
    limit: number;
    currentBuild: Record<string, any>;
  }) {
    const { 
        category, search, brand, socket, ram_type, sort, 
        minPrice, maxPrice, inStockOnly, vramGb, page, limit, currentBuild,
        min_wattage, max_wattage, min_capacity_gb, max_capacity_gb, min_frequency_mhz, max_frequency_mhz
    } = params;

    const offset = (page - 1) * limit;

    // 1. Fetch filtered and sorted components from DB
    const { components, total, in_stock_total } = await this.repository.getComponents({
      category,
      search: search || undefined,
      brand: brand || undefined,
      socket: socket || undefined,
      ram_type: ram_type || undefined,
      sort: sort || undefined,
      vram_gb: vramGb,
      min_price: minPrice ?? undefined,
      max_price: maxPrice ?? undefined,
      min_wattage: min_wattage ?? undefined,
      max_wattage: max_wattage ?? undefined,
      min_capacity_gb: min_capacity_gb ?? undefined,
      max_capacity_gb: max_capacity_gb ?? undefined,
      min_frequency_mhz: min_frequency_mhz ?? undefined,
      max_frequency_mhz: max_frequency_mhz ?? undefined,
      in_stock: inStockOnly || undefined,
      is_active: true,
    }, limit, offset);

    if (components.length === 0) return { components: [], total, in_stock_total: 0, available_brands: [], available_sockets: [], available_vram: [] };

    // 2. Enrich with compatibility (Post-DB)
    const enriched = components.map((component) => {
      const testBuild = { ...currentBuild, [category]: component };

      let compatibility: 'compatible' | 'incompatible' | 'unknown' = 'unknown';
      let compatibility_issues: string[] = [];
      const hasOtherComponents = Object.keys(currentBuild).some((k) => k !== category);

      if (hasOtherComponents) {
        try {
          const result = validateCompatibility(testBuild as any);
          const relevantErrors = result.errors.filter((e: any) => e.components.includes(category));
          if (relevantErrors.length > 0) {
            compatibility = 'incompatible';
            compatibility_issues = relevantErrors.map((e: any) => e.message);
          } else {
            compatibility = 'compatible';
          }
        } catch {
          compatibility = 'unknown';
        }
      } else {
        compatibility = 'compatible';
      }

      return { ...component, compatibility, compatibility_issues };
    });

    const availableBrands = [...new Set(components.map(c => c.brand).filter(Boolean) as string[])].sort();
    const availableSockets = [...new Set(components.map(c => (c as any).socket).filter(Boolean) as string[])].sort();
    const availableVram = [...new Set(components.map(c => (c as any).vram_gb).filter(Boolean) as number[])].sort((a, b) => a - b);

    return {
      components: enriched,
      total,
      in_stock_total: in_stock_total ?? total, 
      available_brands: availableBrands,
      available_sockets: availableSockets,
      available_vram: availableVram,
    };
  }

  async createComponent(data: ComponentInput): Promise<Component> {
    const { name, brand } = data as any;
    const slug = await getUniqueSlug(brand ?? null, name);
    const fields = this.extractComponentFields(data);

    return this.repository.createComponent({
      ...fields,
      slug,
      name,
      brand: brand ?? null
    });
  }

  async updateComponent(id: number, data: ComponentInput): Promise<Component> {
    const { name, brand } = data as any;
    const slug = await getUniqueSlug(brand ?? null, name, id);
    const fields = this.extractComponentFields(data);

    const updated = await this.repository.updateComponent(id, {
      ...fields,
      slug,
      name,
      brand: brand ?? null
    });

    if (!updated) {
      throw new AppError('COMPONENT_NOT_FOUND', `Component with id ${id} not found`, 404);
    }

    await this.repository.resetSuggestionsForComponent(id);

    return updated;
  }

  async deactivateComponent(id: number): Promise<Component> {
    const component = await this.repository.deactivateComponent(id);
    if (!component) {
      throw new AppError('COMPONENT_NOT_FOUND', `Component with id ${id} not found`, 404);
    }
    return component;
  }

  async activateComponent(id: number): Promise<Component> {
    const component = await this.repository.activateComponent(id);
    if (!component) {
      throw new AppError('COMPONENT_NOT_FOUND', `Component with id ${id} not found`, 404);
    }
    return component;
  }

  async deleteComponent(id: number): Promise<void> {
    const component = await this.repository.getComponentById(id, false);
    if (!component) {
      throw new AppError('COMPONENT_NOT_FOUND', `Component with id ${id} not found`, 404);
    }

    const sql = getSql();
    const priceRows = (await sql`SELECT COUNT(id) AS cnt FROM prices WHERE component_id = ${id}`) as { cnt: string }[];
    if (parseInt(priceRows[0].cnt) > 0) {
      throw new AppError('COMPONENT_HAS_DEPENDENCIES', `Component ${id} has linked price records and cannot be deleted. Deactivate it instead.`, 409);
    }

    await this.repository.deleteComponent(id);
  }

  async unlinkComponent(id: number): Promise<{ listings_reset: number }> {
    const component = await this.repository.getComponentById(id, false);
    if (!component) {
      throw new AppError('COMPONENT_NOT_FOUND', `Component with id ${id} not found`, 404);
    }

    const sql = getSql();
    const reset = (await sql`
      UPDATE unmatched_listings
      SET status = 'pending', linked_component_id = NULL
      WHERE linked_component_id = ${id}
      RETURNING id
    `) as { id: number }[];

    await sql`DELETE FROM scraper_mappings WHERE component_id = ${id}`;
    await sql`DELETE FROM prices WHERE component_id = ${id}`;
    await sql`DELETE FROM price_history WHERE component_id = ${id}`;
    await sql`DELETE FROM unmatched_suggestions WHERE existing_component_id = ${id}`;

    await this.repository.deactivateComponent(id);

    return { listings_reset: reset.length };
  }

  private extractComponentFields(data: ComponentInput) {
    const d = data as any;
    return {
      category: d.category,
      description: d.description ?? null,
      specs: d.specs ?? null,
      image_url: d.image_url ?? null,
      image_urls: d.image_urls ?? null,
      release_year: d.release_year ?? null,
      socket: d.socket,
      supported_ram_types: d.supported_ram_types,
      max_ram_frequency: d.max_ram_frequency,
      ram_type: d.ram_type,
      frequency_mhz: d.frequency_mhz,
      length_mm: d.length_mm,
      max_gpu_length_mm: d.max_gpu_length_mm,
      supported_motherboards: d.supported_motherboards,
      max_cooler_height_mm: d.max_cooler_height_mm,
      form_factor: d.form_factor,
      height_mm: d.height_mm,
      wattage: d.wattage,
      tdp: d.tdp,
      ram_slots: d.ram_slots,
      m2_slots: d.m2_slots,
      sata_ports: d.sata_ports,
      core_count: d.core_count,
      thread_count: d.thread_count,
      vram_gb: d.vram_gb,
      capacity_gb: d.capacity_gb,
      kit_count: d.kit_count ?? 1,
      cas_latency: d.cas_latency,
      chipset: d.chipset,
      interface_type: d.interface_type,
      read_speed_mbps: d.read_speed_mbps,
      write_speed_mbps: d.write_speed_mbps,
      efficiency_rating: d.efficiency_rating,
      modular: d.modular,
      base_clock_ghz: d.base_clock_ghz,
      boost_clock_ghz: d.boost_clock_ghz,
      mpn: d.mpn,
      tags: d.tags,
      supported_sockets: d.supported_sockets,
      max_tdp: d.max_tdp,
      psu_form_factor: d.psu_form_factor,
      supported_psu_form_factors: d.supported_psu_form_factors
    };
  }
}

const service = new ComponentService();
export const getComponents = service.getComponents.bind(service);
export const getComponentById = service.getComponentById.bind(service);
export const getComponentsByIds = service.getComponentsByIds.bind(service);
export const getComponentBySlug = service.getComponentBySlug.bind(service);
export const getPricesByComponentId = service.getPricesByComponentId.bind(service);
export const getPriceHistoryApi = service.getPriceHistory.bind(service);
export const createComponent = service.createComponent.bind(service);
export const updateComponent = service.updateComponent.bind(service);
export const deactivateComponent = service.deactivateComponent.bind(service);
export const activateComponent = service.activateComponent.bind(service);
export const deleteComponent = service.deleteComponent.bind(service);
export const unlinkComponent = service.unlinkComponent.bind(service);
