import { UnmatchedRepository, UnmatchedListingFilter } from '../repositories/unmatchedRepository.js';
import { runSuggestionPreprocessing } from '../../services/suggestionPreprocessor.js';
import { logger } from '../../engine/utils/logger.js';
import { getSql } from '../../../../core/db/index.js';
import { getUniqueSlug } from '../../../catalog/services/slugService.js';
import { componentSchemas } from '../../../../core/schemas/componentSchemas.js';
import {
  extractRamSpecs, extractCpuSpecs, extractGpuSpecs,
  extractMotherboardSpecs, extractPsuSpecs, extractCoolingSpecs,
  extractCaseSpecs, extractFanSpecs, extractThermalPasteSpecs,
} from '@shared/component-utils.js';
import { AppError } from '../../../../core/errors/errors.js';

export class UnmatchedService {
  private repository = new UnmatchedRepository();

  async getListings(params: {
    status?: string;
    retailerId?: number;
    search?: string;
    category?: string;
    page: number;
    limit: number;
  }) {
    const offset = (params.page - 1) * params.limit;
    return this.repository.getListings({ ...params, offset });
  }

  async linkListing(id: number, componentId: number) {
    // Verify component exists
    const sql = getSql();
    const components = await sql`SELECT id FROM components WHERE id = ${componentId} LIMIT 1` as { id: number }[];
    if (components.length === 0) {
      throw new AppError('NOT_FOUND', `Component ${componentId} not found`, 404);
    }

    const mappingId = await this.repository.linkListingToComponent(id, componentId);
    if (!mappingId) {
      throw new AppError('NOT_FOUND', `Unmatched listing ${id} not found`, 404);
    }

    return mappingId;
  }

  async dismissListing(id: number) {
    const dismissed = await this.repository.bulkDismiss([id]);
    if (dismissed === 0) {
      throw new AppError('NOT_FOUND', `Unmatched listing ${id} not found`, 404);
    }
    return true;
  }

  async updateCategory(id: number, category: string | null) {
    const success = await this.repository.updateManualCategory(id, category);
    if (!success) {
      throw new AppError('NOT_FOUND', `Unmatched listing ${id} not found`, 404);
    }
    return true;
  }

  async getCategorySummary() {
    return this.repository.getCategorySummary();
  }

  async getGroupedListings(filters: UnmatchedListingFilter, page: number, limit: number, offsetParam?: number) {
    const rows = await this.repository.getPendingListingsWithSuggestions(filters);
    const offset = offsetParam !== undefined ? offsetParam : (page - 1) * limit;

    const groupMap = new Map<string, any>();

    for (const row of rows) {
      const key = row.canonical_name;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          canonical_name: row.canonical_name,
          brand: row.brand,
          category: row.category,
          confidence: row.confidence,
          existing_component_id: row.existing_component_id,
          existing_component_name: row.existing_component_name
            ? `${row.existing_component_brand ? row.existing_component_brand + ' ' : ''}${row.existing_component_name}`
            : null,
          specs_hint: row.specs_hint ?? {},
          listings: [],
        });
      }
      groupMap.get(key)!.listings.push(row);
    }

    const allGroups = [...groupMap.values()].sort((a, b) => b.listings.length - a.listings.length);
    const total_groups = allGroups.length;
    const total_listings = rows.length;
    const paginatedGroups = allGroups.slice(offset, offset + limit);

    const groups = paginatedGroups.map((g) => ({
      canonical_name: g.canonical_name,
      brand: g.brand,
      category: g.category,
      confidence: g.confidence,
      existing_component_id: g.existing_component_id,
      existing_component_name: g.existing_component_name,
      specs_hint: g.specs_hint,
      retailer_count: new Set(g.listings.map((l: any) => l.retailer_id)).size,
      listing_count: g.listings.length,
      price_min: g.listings.reduce((min: number | null, l: any) => {
        const p = l.scraped_price ? Number(l.scraped_price) : null;
        return p !== null && (min === null || p < min) ? p : min;
      }, null as number | null),
      price_max: g.listings.reduce((max: number | null, l: any) => {
        const p = l.scraped_price ? Number(l.scraped_price) : null;
        return p !== null && (max === null || p > max) ? p : max;
      }, null as number | null),
      listings: g.listings.map((l: any) => ({
        id: l.id,
        retailer_id: l.retailer_id,
        retailer_name: l.retailer_name,
        scraped_name: l.scraped_name,
        scraped_price: l.scraped_price ? Number(l.scraped_price) : null,
        product_url: l.product_url,
        image_url: l.image_url,
        image_urls: l.image_urls,
        scraped_at: l.scraped_at,
        confidence: l.confidence,
      })),
    }));

    return { groups, total_groups, total_listings };
  }

  async reprocessSuggestions() {
    (async () => {
      try {
        const { reprocessUnmatched } = await import('../../../scraper/aggregator.js');
        await reprocessUnmatched();
        await runSuggestionPreprocessing(true);
      } catch (err: any) {
        logger.error(`[SUGGESTIONS] Background reprocessing failed: ${err.message}`);
      }
    })();
  }

  async autoBuild() {
    const { reprocessUnmatched } = await import('../../../scraper/aggregator.js');
    reprocessUnmatched().catch((err: any) =>
      logger.error(`[CATALOG] Auto-build failed: ${err.message}`)
    );
  }

  async bulkDismiss(listingIds: number[]) {
    return this.repository.bulkDismiss(listingIds);
  }

  async bulkApprove(canonicalNames: string[]) {
    const sql = getSql();
    const groups = await this.repository.getHighConfidenceLinks(canonicalNames);

    if (groups.length === 0) return { approved_groups: 0, linked_listings: 0, skipped_groups: canonicalNames.length };

    let approved_groups = 0;
    let linked_listings = 0;
    const skipped_groups = canonicalNames.length - new Set(groups.map((g) => g.canonical_name)).size;

    await sql.begin(async (tx) => {
      for (const row of groups) {
        await tx`
          INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
          VALUES (${row.existing_component_id}, ${row.retailer_id}, ${row.product_url}, ${row.scraped_name})
          ON CONFLICT (retailer_id, product_url) DO UPDATE SET
            component_id = EXCLUDED.component_id,
            updated_at   = NOW()
        `;
        await tx`
          UPDATE unmatched_listings
          SET status = 'linked', linked_component_id = ${row.existing_component_id}
          WHERE id = ${row.listing_id}
        `;
        await tx`DELETE FROM unmatched_suggestions WHERE unmatched_listing_id = ${row.listing_id} `;
        linked_listings++;
      }
      approved_groups = new Set(groups.map((g) => g.canonical_name)).size;
    });

    return { approved_groups, linked_listings, skipped_groups };
  }

  async createAndLink(params: {
    name: string;
    brand?: string;
    category: string;
    specs?: Record<string, any>;
    listing_ids: number[];
    link_to_existing?: boolean;
    existing_component_id?: number;
  }) {
    const { name, brand, category, specs, listing_ids, link_to_existing, existing_component_id } = params;
    const sql = getSql();

    if (link_to_existing && existing_component_id) {
      const listings = await this.repository.getListingsByIds(listing_ids);
      if (listings.length === 0) throw new AppError('NOT_FOUND', 'No pending listings found', 404);

      await sql.begin(async (tx) => {
        await this.repository.linkListingsToComponent(tx, listing_ids, existing_component_id);
      });

      runSuggestionPreprocessing().catch(() => {});
      return { component_id: existing_component_id, linked_count: listings.length };
    }

    const canonicalName = name.trim();
    const brandVal = brand?.trim() ?? null;
    const duplicates = await this.repository.findDuplicateComponent(canonicalName, category, brandVal);

    if (duplicates.length > 0) {
      throw new AppError('DUPLICATE_COMPONENT', `A component named "${canonicalName}" already exists`, 409);
    }

    const listings = await this.repository.getListingsByIds(listing_ids);
    if (listings.length === 0) throw new AppError('NOT_FOUND', 'No pending listings found', 404);

    const slug = await getUniqueSlug(brandVal, canonicalName);
    const s = this.enrichSpecs(category, canonicalName, specs ?? {});

    let newComponentId: number;
    await sql.begin(async (tx) => {
      const inserted = (await tx`
        INSERT INTO components (
          slug, name, brand, category,
          socket, supported_ram_types, max_ram_frequency,
          ram_type, frequency_mhz,
          length_mm, max_gpu_length_mm,
          supported_motherboards, max_cooler_height_mm,
          form_factor, height_mm,
          wattage, tdp,
          ram_slots, m2_slots, sata_ports,
          size_mm, airflow_cfm, noise_db, rgb, pack_size,
          weight_grams, thermal_conductivity, paste_type,
          is_active
        ) VALUES (
          ${slug}, ${canonicalName}, ${brandVal}, ${category},
          ${(s.socket) ?? null},
          ${(s.supported_ram_types) ?? null},
          ${(s.max_ram_frequency) ?? null},
          ${(s.ram_type) ?? null},
          ${(s.frequency_mhz) ?? null},
          ${(s.length_mm) ?? null},
          ${(s.max_gpu_length_mm) ?? null},
          ${(s.supported_motherboards) ?? null},
          ${(s.max_cooler_height_mm) ?? null},
          ${(s.form_factor) ?? null},
          ${(s.height_mm) ?? null},
          ${(s.wattage) ?? null},
          ${(s.tdp) ?? null},
          ${(s.ram_slots) ?? null},
          ${(s.m2_slots) ?? null},
          ${(s.sata_ports) ?? null},
          ${(s.size_mm) ?? null},
          ${(s.airflow_cfm) ?? null},
          ${(s.noise_db) ?? null},
          ${(s.rgb) ?? null},
          ${(s.pack_size) ?? null},
          ${(s.weight_grams) ?? null},
          ${(s.thermal_conductivity) ?? null},
          ${(s.paste_type) ?? null},
          true
        )
        RETURNING id
      `) as { id: number }[];

      newComponentId = inserted[0].id;
      await this.repository.linkListingsToComponent(tx, listing_ids, newComponentId);
    });

    runSuggestionPreprocessing().catch(() => {});
    return { component_id: newComponentId!, component_slug: slug, linked_count: listings.length };
  }

  private enrichSpecs(category: string, name: string, s: Record<string, any>) {
    if (category === 'ram') {
      const extracted = extractRamSpecs(name);
      if (!s.ram_type) s.ram_type = extracted.ram_type;
      if (!s.frequency_mhz) s.frequency_mhz = extracted.frequency_mhz;
    } else if (category === 'cpu') {
      const extracted = extractCpuSpecs(name);
      if (!s.socket && extracted?.socket) s.socket = extracted.socket;
    } else if (category === 'gpu') {
      const extracted = extractGpuSpecs(name);
      if (!s.length_mm && extracted?.length_mm) s.length_mm = extracted.length_mm;
    } else if (category === 'motherboard') {
      const extracted = extractMotherboardSpecs(name);
      if (extracted) {
        if (!s.socket && extracted.socket) s.socket = extracted.socket;
        if (!s.supported_ram_types && extracted.supported_ram_types) s.supported_ram_types = extracted.supported_ram_types;
        if (!s.max_ram_frequency && extracted.max_ram_frequency) s.max_ram_frequency = extracted.max_ram_frequency;
      }
    } else if (category === 'psu') {
      const extracted = extractPsuSpecs(name);
      if (!s.wattage && extracted?.wattage) s.wattage = extracted.wattage;
    } else if (category === 'cooling') {
      const extracted = extractCoolingSpecs(name);
      if (!s.tdp && extracted?.tdp) s.tdp = extracted.tdp;
    } else if (category === 'case') {
      const extracted = extractCaseSpecs(name);
      if (!s.max_gpu_length_mm && extracted?.max_gpu_length_mm) s.max_gpu_length_mm = extracted.max_gpu_length_mm;
    } else if (category === 'fan') {
      const extracted = extractFanSpecs(name);
      if (!s.size_mm && extracted?.size_mm) s.size_mm = extracted.size_mm;
    } else if (category === 'thermal_paste') {
      const extracted = extractThermalPasteSpecs(name);
      if (!s.weight_grams && extracted?.weight_grams) s.weight_grams = extracted.weight_grams;
      if (!s.paste_type && extracted?.paste_type) s.paste_type = extracted.paste_type;
    }
    return s;
  }
}
