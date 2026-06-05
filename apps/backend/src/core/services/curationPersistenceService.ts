import { join } from 'node:path';
import { writeFile, readFile, access } from 'node:fs/promises';
import { getSql } from '../db/index.js';
import { logger } from '../../modules/scraping/engine/utils/logger.js';

const SEED_DIR = join(import.meta.dirname, '../../../seed');
const CURATED_CATALOG_PATH = join(SEED_DIR, 'curated_catalog.json');

export interface CuratedComponent {
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  socket?: string | null;
  supported_ram_types?: string[] | null;
  max_ram_frequency?: number | null;
  ram_type?: string | null;
  frequency_mhz?: number | null;
  kit_count?: number | null;
  cas_latency?: number | null;
  capacity_gb?: number | null;
  vram_gb?: number | null;
  core_count?: number | null;
  thread_count?: number | null;
  length_mm?: number | null;
  max_gpu_length_mm?: number | null;
  supported_motherboards?: string[] | null;
  max_cooler_height_mm?: number | null;
  form_factor?: string | null;
  height_mm?: number | null;
  wattage?: number | null;
  tdp?: number | null;
  ram_slots?: number | null;
  m2_slots?: number | null;
  sata_ports?: number | null;
  size_mm?: number | null;
  airflow_cfm?: number | null;
  noise_db?: number | null;
  rgb?: boolean | null;
  pack_size?: number | null;
  weight_grams?: number | null;
  thermal_conductivity?: number | null;
  paste_type?: string | null;
  tags?: string[] | null;
  chipset?: string | null;
  specs?: any | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  is_active?: boolean;
}

export interface CuratedMapping {
  retailer_id: number;
  product_url: string;
  product_identifier: string | null;
  component_slug: string;
}

export interface CuratedDismissal {
  retailer_id: number;
  product_url: string;
}

export interface CuratedCatalog {
  components: CuratedComponent[];
  mappings: CuratedMapping[];
  dismissed: CuratedDismissal[];
}

export class CurationPersistenceService {
  /**
   * Exports all components, mappings, and dismissed listings into seed/curated_catalog.json
   */
  static async exportCuratedCatalog(): Promise<boolean> {
    const sql = getSql();
    try {
      // 1. Fetch all components
      const components = await sql`
        SELECT 
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
          tags, chipset, specs, image_url, image_urls, is_active
        FROM components
        ORDER BY id
      ` as CuratedComponent[];

      // 2. Fetch all mappings linked by component slug
      const mappings = await sql`
        SELECT 
          sm.retailer_id, sm.product_url, sm.product_identifier, c.slug AS component_slug
        FROM scraper_mappings sm
        JOIN components c ON c.id = sm.component_id
        ORDER BY sm.id
      ` as CuratedMapping[];

      // 3. Fetch all dismissed items
      const dismissed = await sql`
        SELECT retailer_id, product_url
        FROM unmatched_listings
        WHERE status = 'dismissed'
        ORDER BY id
      ` as CuratedDismissal[];

      const payload: CuratedCatalog = {
        components,
        mappings,
        dismissed
      };

      // Write to curated_catalog.json
      await writeFile(CURATED_CATALOG_PATH, JSON.stringify(payload, null, 2), 'utf-8');
      await logger.info(`[CURATION] Successfully exported curated catalog: ${components.length} components, ${mappings.length} mappings, ${dismissed.length} dismissals.`);
      return true;
    } catch (err: any) {
      await logger.error(`[CURATION] Failed to export curated catalog: ${err.message}`);
      return false;
    }
  }

  /**
   * Imports components, mappings, and dismissals from seed/curated_catalog.json into the database
   */
  static async importCuratedCatalog(txSql?: any): Promise<boolean> {
    const sql = txSql || getSql();
    try {
      // Check if seed file exists
      try {
        await access(CURATED_CATALOG_PATH);
      } catch {
        await logger.info('[CURATION] No curated_catalog.json found to seed. Skipping.');
        return false;
      }

      const content = await readFile(CURATED_CATALOG_PATH, 'utf-8');
      const payload = JSON.parse(content) as CuratedCatalog;

      if (!payload.components || !Array.isArray(payload.components)) {
        throw new Error('Invalid JSON format: missing components array.');
      }

      await logger.info(`[CURATION] Seeding curated catalog: ${payload.components.length} components, ${payload.mappings?.length ?? 0} mappings...`);

      // 1. Seed components
      if (payload.components.length > 0) {
        const dbComponents = payload.components.map(c => {
          const supportedRamStr = c.supported_ram_types && c.supported_ram_types.length > 0
            ? `{${c.supported_ram_types.map(t => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`
            : null;
          const supportedMoboStr = c.supported_motherboards && c.supported_motherboards.length > 0
            ? `{${c.supported_motherboards.map(t => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`
            : null;
          const tagsStr = c.tags && c.tags.length > 0
            ? `{${c.tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`
            : null;
          const imageUrlsStr = c.image_urls && c.image_urls.length > 0
            ? `{${c.image_urls.map(t => `"${t.replace(/"/g, '\\"')}"`).join(',')}}`
            : null;

          return {
            ...c,
            supported_ram_types: supportedRamStr as any,
            supported_motherboards: supportedMoboStr as any,
            tags: tagsStr as any,
            image_urls: imageUrlsStr as any,
            specs: c.specs ? JSON.stringify(c.specs) : null
          };
        });

        for (const comp of dbComponents) {
          await sql`
            INSERT INTO components ${ sql([comp]) }
            ON CONFLICT (slug) DO UPDATE SET
              name = EXCLUDED.name,
              brand = EXCLUDED.brand,
              category = EXCLUDED.category,
              socket = EXCLUDED.socket,
              supported_ram_types = EXCLUDED.supported_ram_types,
              max_ram_frequency = EXCLUDED.max_ram_frequency,
              ram_type = EXCLUDED.ram_type,
              frequency_mhz = EXCLUDED.frequency_mhz,
              kit_count = EXCLUDED.kit_count,
              cas_latency = EXCLUDED.cas_latency,
              capacity_gb = EXCLUDED.capacity_gb,
              vram_gb = EXCLUDED.vram_gb,
              core_count = EXCLUDED.core_count,
              thread_count = EXCLUDED.thread_count,
              length_mm = EXCLUDED.length_mm,
              max_gpu_length_mm = EXCLUDED.max_gpu_length_mm,
              supported_motherboards = EXCLUDED.supported_motherboards,
              max_cooler_height_mm = EXCLUDED.max_cooler_height_mm,
              form_factor = EXCLUDED.form_factor,
              height_mm = EXCLUDED.height_mm,
              wattage = EXCLUDED.wattage,
              tdp = EXCLUDED.tdp,
              ram_slots = EXCLUDED.ram_slots,
              m2_slots = EXCLUDED.m2_slots,
              sata_ports = EXCLUDED.sata_ports,
              size_mm = EXCLUDED.size_mm,
              airflow_cfm = EXCLUDED.airflow_cfm,
              noise_db = EXCLUDED.noise_db,
              rgb = EXCLUDED.rgb,
              pack_size = EXCLUDED.pack_size,
              weight_grams = EXCLUDED.weight_grams,
              thermal_conductivity = EXCLUDED.thermal_conductivity,
              paste_type = EXCLUDED.paste_type,
              tags = EXCLUDED.tags,
              chipset = EXCLUDED.chipset,
              specs = EXCLUDED.specs,
              image_url = EXCLUDED.image_url,
              image_urls = EXCLUDED.image_urls,
              is_active = EXCLUDED.is_active,
              updated_at = NOW()
          `;
        }
      }

      const compRows = await sql`SELECT id, slug FROM components` as { id: number; slug: string }[];
      const slugToIdMap = new Map<string, number>(compRows.map(r => [r.slug, r.id]));

      // 2. Seed mappings
      if (payload.mappings && payload.mappings.length > 0) {
        const mappingsToInsert: any[] = [];
        for (const m of payload.mappings) {
          const compId = slugToIdMap.get(m.component_slug);
          if (compId) {
            mappingsToInsert.push({
              component_id: compId,
              retailer_id: m.retailer_id,
              product_url: m.product_url,
              product_identifier: m.product_identifier
            });
          }
        }

        if (mappingsToInsert.length > 0) {
          for (const mapping of mappingsToInsert) {
            await sql`
              INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
              VALUES (${mapping.component_id}, ${mapping.retailer_id}, ${mapping.product_url}, ${mapping.product_identifier})
              ON CONFLICT (retailer_id, product_url) DO UPDATE SET
                component_id = EXCLUDED.component_id,
                product_identifier = EXCLUDED.product_identifier,
                updated_at = NOW()
            `;
          }
        }
      }

      // 3. Seed dismissed listings
      if (payload.dismissed && payload.dismissed.length > 0) {
        for (const d of payload.dismissed) {
          await sql`
            INSERT INTO unmatched_listings (retailer_id, product_url, scraped_name, status)
            VALUES (${d.retailer_id}, ${d.product_url}, 'Dismissed Product', 'dismissed')
            ON CONFLICT (retailer_id, product_url) DO UPDATE SET
              status = 'dismissed'
          `;
        }
      }

      await logger.info('[CURATION] Seeding curated catalog completed successfully.');
      return true;
    } catch (err: any) {
      await logger.error(`[CURATION] Seeding curated catalog failed: ${err.message}`);
      return false;
    }
  }
}
