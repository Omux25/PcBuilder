import { UnmatchedRepository } from '../repositories/unmatchedRepository.js';
import { CurationPersistenceService } from '../../../../core/services/curationPersistenceService.js';
import type { UnmatchedListingFilter } from '../repositories/unmatchedRepository.js';
import { logger } from '../../engine/utils/logger.js';
import { getSql } from '../../../../core/db/index.js';
import { getUniqueSlug } from '../../../catalog/services/slugService.js';
import { extractCpuSpecs } from '@shared/hardware/specs/cpu.js';
import { extractGpuSpecs } from '@shared/hardware/specs/gpu.js';
import { extractRamSpecs } from '@shared/hardware/specs/ram.js';
import { extractMotherboardSpecs } from '@shared/hardware/specs/motherboard.js';
import { extractPsuSpecs, normalizeEfficiencyRating, normalizeModularity, normalizePsuFormFactor } from '@shared/hardware/specs/psu.js';
import { extractCaseSpecs } from '@shared/hardware/specs/case.js';
import { extractCoolingSpecs } from '@shared/hardware/specs/cooling.js';
import { extractFanSpecs } from '@shared/hardware/specs/fan.js';
import { extractThermalPasteSpecs } from '@shared/hardware/specs/thermal-paste.js';
import { extractStorageSpecs } from '@shared/hardware/specs/storage.js';
import { extractBrand } from '@shared/hardware/brands.js';
import { AppError } from '../../../../core/errors/errors.js';
import { buildSpecsPayload } from '@shared/hardware/specs/buildSpecs.js';

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

    CurationPersistenceService.exportCuratedCatalog().catch(err => {
      logger.error(`[CURATION] Background export failed on linkListing: ${err.message}`);
    });

    return mappingId;
  }

  async dismissListing(id: number) {
    const dismissed = await this.repository.bulkDismiss([id]);
    if (dismissed === 0) {
      throw new AppError('NOT_FOUND', `Unmatched listing ${id} not found`, 404);
    }
    CurationPersistenceService.exportCuratedCatalog().catch(err => {
      logger.error(`[CURATION] Background export failed on dismissListing: ${err.message}`);
    });
    return true;
  }

  async updateCategory(id: number, category: string | null) {
    const success = await this.repository.updateManualCategory(id, category);
    if (!success) {
      throw new AppError('NOT_FOUND', `Unmatched listing ${id} not found`, 404);
    }
    return true;
  }

  async bulkUpdateCategory(ids: number[], category: string | null) {
    const count = await this.repository.bulkUpdateManualCategory(ids, category);
    if (count > 0) {
      // Intentionally NOT calling runSuggestionPreprocessing here.
      // Re-processing 7,000+ items on every single category dropdown change 
      // saturates the DB connection pool and blocks the Node event loop.
      // The user can use the "Tout Traiter" button to explicitly apply new learnings to other items.
    }
    CurationPersistenceService.exportCuratedCatalog().catch(err => {
      logger.error(`[CURATION] Background export failed on bulkUpdateCategory: ${err.message}`);
    });
    return count;
  }

  async bulkConfirmAllWithCategories(category?: string) {
    const sql = getSql();
    // 1. Fetch all pending listings with suggested categories
    const listings = await this.repository.getPendingWithCategory(category);
    if (listings.length === 0) {
      return { linked_listings: 0, created_components: 0, created_listings: 0 };
    }

    // 2. Group into:
    //    - existingToLink: grouped by existing_component_id -> list of listing_ids
    //    - newToCreate: grouped by canonical_name (lower case) + category -> list of listings
    const existingToLink = new Map<number, number[]>();
    const newToCreate = new Map<string, typeof listings>();

    for (const listing of listings) {
      if (listing.existing_component_id) {
        const list = existingToLink.get(listing.existing_component_id) || [];
        list.push(listing.listing_id);
        existingToLink.set(listing.existing_component_id, list);
      } else {
        const key = `${listing.canonical_name.trim().toLowerCase()}|${listing.category.trim().toLowerCase()}`;
        const list = newToCreate.get(key) || [];
        list.push(listing);
        newToCreate.set(key, list);
      }
    }

    let linked_listings = 0;
    let created_components = 0;
    let created_listings = 0;

    await sql.begin(async (tx) => {
      // 3. Process links to existing components
      for (const [compId, listingIds] of existingToLink) {
        await this.repository.linkListingsToComponent(tx, listingIds, compId);
        linked_listings += listingIds.length;
      }

      // 4. Process new component creations
      for (const [, groupListings] of newToCreate) {
        const sample = groupListings[0];
        const canonicalName = sample.canonical_name.trim();
        const brandVal = sample.brand?.trim() ?? null;
        const category = sample.category;

        // Check if component already exists in DB to prevent duplicates in edge cases
        const duplicates = await this.repository.findDuplicateComponent(canonicalName, category, brandVal);
        let compId: number;

        if (duplicates.length > 0) {
          compId = duplicates[0].id;
        } else {
          // Create new component
          const slug = await getUniqueSlug(brandVal, canonicalName);
          const s = this.enrichSpecs(category, canonicalName, { ...sample.specs_hint });

          // Pick the best image_url and collect all unique image_urls from the group listings
          const primaryListing = groupListings.find(l => l.image_url) ?? sample;
          const imageUrl = primaryListing.image_url ?? null;

          const uniqueImages = new Set<string>();
          for (const listing of groupListings) {
            if (listing.image_url) uniqueImages.add(listing.image_url);
            if (listing.image_urls && Array.isArray(listing.image_urls)) {
              for (const url of listing.image_urls) {
                if (url) uniqueImages.add(url);
              }
            }
          }
          const imageUrls = Array.from(uniqueImages);

          const specsPayload = buildSpecsPayload(category, s);

          const inserted = (await tx`
            INSERT INTO components (
              slug, name, brand, category,
              socket, supported_ram_types, max_ram_frequency,
              ram_type, frequency_mhz, kit_count, cas_latency,
              capacity_gb, vram_gb, core_count, thread_count,
              length_mm, max_gpu_length_mm,
              supported_motherboards, max_cooler_height_mm,
              form_factor, height_mm,
              wattage, tdp,
              ram_slots, m2_slots, sata_ports,
              size_mm, airflow_cfm, noise_db, rgb, pack_size,
              weight_grams, thermal_conductivity, paste_type,
              tags,
              chipset,
              specs,
              image_url, image_urls,
              is_active,
              base_clock_ghz, boost_clock_ghz,
              interface_type, read_speed_mbps, write_speed_mbps,
              efficiency_rating, modular,
              mpn
            ) VALUES (
              ${slug}, ${canonicalName}, ${brandVal}, ${category},
              ${(s.socket) ?? null},
              ${(s.supported_ram_types && s.supported_ram_types.length > 0) ? `{${s.supported_ram_types.map((t: string) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}` : null}::text[],
              ${(s.max_ram_frequency) ?? null},
              ${(s.ram_type) ?? null},
              ${(s.frequency_mhz) ?? null},
              ${(s.kit_count) ?? 1},
              ${(s.cas_latency) ?? null},
              ${(s.capacity_gb) ?? null},
              ${(s.vram_gb) ?? null},
              ${(s.core_count) ?? null},
              ${(s.thread_count) ?? null},
              ${(s.length_mm) ?? null},
              ${(s.max_gpu_length_mm) ?? null},
              ${(s.supported_motherboards && s.supported_motherboards.length > 0) ? `{${s.supported_motherboards.map((t: string) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}` : null}::text[],
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
              ${(s.tags && s.tags.length > 0) ? `{${s.tags.map((t: string) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}` : null}::text[],
              ${(s.chipset) ?? null},
              ${specsPayload ? JSON.stringify(specsPayload) : null},
              ${imageUrl},
              ${(imageUrls && imageUrls.length > 0) ? `{${imageUrls.map((t: string) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}` : null}::text[],
              true,
              ${(s.base_clock_ghz) ?? null}, ${(s.boost_clock_ghz) ?? null},
              ${(s.interface_type) ?? null}, ${(s.read_speed_mbps) ?? null}, ${(s.write_speed_mbps) ?? null},
              ${(s.efficiency_rating) ?? null}, ${(s.modular) ?? null},
              ${(s.mpn) ?? null}
            )
            RETURNING id
          `) as { id: number }[];

          compId = inserted[0].id;
          created_components++;
        }

        const listingIds = groupListings.map(l => l.listing_id);
        await this.repository.linkListingsToComponent(tx, listingIds, compId);
        created_listings += listingIds.length;
      }
    });

    CurationPersistenceService.exportCuratedCatalog().catch(err => {
      logger.error(`[CURATION] Background export failed on bulkConfirmAllWithCategories: ${err.message}`);
    });

    return { linked_listings, created_components, created_listings };
  }

  async getCategorySummary(filters?: { confidence?: string; hasExisting?: string }) {
    return this.repository.getCategorySummary(filters);
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

    const allGroups = [...groupMap.values()].sort((a, b) => {
      const aNotHigh = a.confidence !== 'high' ? 1 : 0;
      const bNotHigh = b.confidence !== 'high' ? 1 : 0;
      if (aNotHigh !== bNotHigh) {
        return bNotHigh - aNotHigh;
      }
      return b.listings.length - a.listings.length;
    });
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
        const { reprocessUnmatched } = await import('../../engine/aggregator.js');
        await reprocessUnmatched();
      } catch (err: any) {
        logger.error(`[SUGGESTIONS] Background reprocessing failed: ${err.message}`);
      }
    })();
  }

  async autoBuild() {
    const { reprocessUnmatched } = await import('../../engine/aggregator.js');
    reprocessUnmatched().catch((err: any) =>
      logger.error(`[CATALOG] Auto-build failed: ${err.message}`)
    );
  }

  async bulkDismiss(listingIds: number[]) {
    const count = await this.repository.bulkDismiss(listingIds);
    CurationPersistenceService.exportCuratedCatalog().catch(err => {
      logger.error(`[CURATION] Background export failed on bulkDismiss: ${err.message}`);
    });
    return count;
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

    CurationPersistenceService.exportCuratedCatalog().catch(err => {
      logger.error(`[CURATION] Background export failed on bulkApprove: ${err.message}`);
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
    const s = this.enrichSpecs(category, canonicalName, { ...specs });

    // Pick the best image_url and collect all unique image_urls from listings
    const primaryListing = listings.find(l => l.image_url);
    const imageUrl = primaryListing ? primaryListing.image_url : null;

    const uniqueImages = new Set<string>();
    for (const listing of listings) {
      if (listing.image_url) uniqueImages.add(listing.image_url);
      if (listing.image_urls && Array.isArray(listing.image_urls)) {
        for (const url of listing.image_urls) {
          if (url) uniqueImages.add(url);
        }
      }
    }
    const imageUrls = Array.from(uniqueImages);

    const specsPayload = buildSpecsPayload(category, s);

    let newComponentId: number;
    await sql.begin(async (tx) => {
      const inserted = (await tx`
        INSERT INTO components (
          slug, name, brand, category,
          socket, supported_ram_types, max_ram_frequency,
          ram_type, frequency_mhz, kit_count, cas_latency,
          capacity_gb, vram_gb, core_count, thread_count,
          length_mm, max_gpu_length_mm,
          supported_motherboards, max_cooler_height_mm,
          form_factor, height_mm,
          wattage, tdp,
          ram_slots, m2_slots, sata_ports,
          size_mm, airflow_cfm, noise_db, rgb, pack_size,
          weight_grams, thermal_conductivity, paste_type,
          tags,
          chipset,
          specs,
          image_url, image_urls,
          is_active,
          base_clock_ghz, boost_clock_ghz,
          interface_type, read_speed_mbps, write_speed_mbps,
          efficiency_rating, modular,
          mpn
        ) VALUES (
          ${slug}, ${canonicalName}, ${brandVal}, ${category},
          ${(s.socket) ?? null},
          ${(s.supported_ram_types && s.supported_ram_types.length > 0) ? `{${s.supported_ram_types.map((t: string) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}` : null}::text[],
          ${(s.max_ram_frequency) ?? null},
          ${(s.ram_type) ?? null},
          ${(s.frequency_mhz) ?? null},
          ${(s.kit_count) ?? 1},
          ${(s.cas_latency) ?? null},
          ${(s.capacity_gb) ?? null},
          ${(s.vram_gb) ?? null},
          ${(s.core_count) ?? null},
          ${(s.thread_count) ?? null},
          ${(s.length_mm) ?? null},
          ${(s.max_gpu_length_mm) ?? null},
          ${(s.supported_motherboards && s.supported_motherboards.length > 0) ? `{${s.supported_motherboards.map((t: string) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}` : null}::text[],
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
          ${(s.tags && s.tags.length > 0) ? `{${s.tags.map((t: string) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}` : null}::text[],
          ${(s.chipset) ?? null},
          ${specsPayload ? JSON.stringify(specsPayload) : null},
          ${imageUrl},
          ${(imageUrls && imageUrls.length > 0) ? `{${imageUrls.map((t: string) => `"${t.replace(/"/g, '\\"')}"`).join(',')}}` : null}::text[],
          true,
          ${(s.base_clock_ghz) ?? null}, ${(s.boost_clock_ghz) ?? null},
          ${(s.interface_type) ?? null}, ${(s.read_speed_mbps) ?? null}, ${(s.write_speed_mbps) ?? null},
          ${(s.efficiency_rating) ?? null}, ${(s.modular) ?? null},
          ${(s.mpn) ?? null}
        )
        RETURNING id
      `) as { id: number }[];

      newComponentId = inserted[0].id;
      await this.repository.linkListingsToComponent(tx, listing_ids, newComponentId);
    });

    CurationPersistenceService.exportCuratedCatalog().catch(err => {
      logger.error(`[CURATION] Background export failed on createAndLink: ${err.message}`);
    });

    return { component_id: newComponentId!, component_slug: slug, linked_count: listings.length };
  }

  private enrichSpecs(category: string, name: string, s: Record<string, any>) {
    if (category === 'ram') {
      const extracted = extractRamSpecs(name);
      if (!s.ram_type) s.ram_type = extracted.ram_type;
      if (!s.frequency_mhz) s.frequency_mhz = extracted.frequency_mhz;
      if (!s.capacity_gb) s.capacity_gb = extracted.capacity_gb;
      if (!s.kit_count) s.kit_count = extracted.kit_count;
      if (!s.cas_latency) s.cas_latency = extracted.cas_latency;
    } else if (category === 'cpu') {
      const extracted = extractCpuSpecs(name);
      if (extracted) {
        if (!s.socket && extracted.socket) s.socket = extracted.socket;
        if (!s.core_count && extracted.core_count) s.core_count = extracted.core_count;
        if (!s.thread_count && extracted.thread_count) s.thread_count = extracted.thread_count;
        if (!s.tdp && extracted.tdp) s.tdp = extracted.tdp;
        if (!s.base_clock_ghz && extracted.base_clock_ghz) s.base_clock_ghz = extracted.base_clock_ghz;
        if (!s.boost_clock_ghz && extracted.boost_clock_ghz) s.boost_clock_ghz = extracted.boost_clock_ghz;
        if ((!s.supported_ram_types || s.supported_ram_types.length === 0) && extracted.supported_ram_types) s.supported_ram_types = extracted.supported_ram_types;
      }
    } else if (category === 'gpu') {
      const extracted = extractGpuSpecs(name);
      if (extracted) {
        if (!s.length_mm && extracted.length_mm) s.length_mm = extracted.length_mm;
        if (!s.vram_gb && extracted.vram_gb) s.vram_gb = extracted.vram_gb;
        if (!s.tdp && extracted.tdp) s.tdp = extracted.tdp;
        if (!s.chipset && extracted.chipset) s.chipset = extracted.chipset;
      }
    } else if (category === 'motherboard') {
      const brand = extractBrand(name) || undefined;
      const extracted = extractMotherboardSpecs(name, brand);
      if (extracted) {
        if (!s.socket && extracted.socket) s.socket = extracted.socket;
        if (!s.supported_ram_types && extracted.supported_ram_types) s.supported_ram_types = extracted.supported_ram_types;
        if (!s.max_ram_frequency && extracted.max_ram_frequency) s.max_ram_frequency = extracted.max_ram_frequency;
        if (!s.form_factor && extracted.form_factor) s.form_factor = extracted.form_factor;
        if (!s.ram_slots && extracted.ram_slots) s.ram_slots = extracted.ram_slots;
      }
    } else if (category === 'storage') {
      const extracted = extractStorageSpecs(name);
      if (extracted) {
        if (!s.capacity_gb && extracted.capacity_gb) s.capacity_gb = extracted.capacity_gb;
        if (!s.interface_type && extracted.interface_type) s.interface_type = extracted.interface_type;
        if (!s.read_speed_mbps && extracted.read_speed_mbps) s.read_speed_mbps = extracted.read_speed_mbps;
        if (!s.write_speed_mbps && extracted.write_speed_mbps) s.write_speed_mbps = extracted.write_speed_mbps;
      }
    } else if (category === 'psu') {
      const extracted = extractPsuSpecs(name);
      if (extracted) {
        if (!s.wattage && extracted.wattage) s.wattage = extracted.wattage;
        if (!s.efficiency_rating && extracted.efficiency) s.efficiency_rating = normalizeEfficiencyRating(extracted.efficiency);
        if (!s.modular && extracted.modularity) s.modular = normalizeModularity(extracted.modularity);
        if (!s.psu_form_factor && extracted.form_factor) s.psu_form_factor = normalizePsuFormFactor(extracted.form_factor);
      }
    } else if (category === 'cooling') {
      const extracted = extractCoolingSpecs(name);
      if (!s.tdp && extracted?.tdp) s.tdp = extracted.tdp;
      if (!s.tags && extracted?.tags) s.tags = extracted.tags;
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
