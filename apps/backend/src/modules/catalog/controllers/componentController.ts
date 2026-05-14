import { Context } from 'hono';
import Papa from 'papaparse';
import { ComponentService } from '../services/componentService.js';
import { logActivity } from '../../admin/services/adminService.js';
import { AppError } from '../../../core/errors/errors.js';
import { componentSchemas, type ComponentInput } from '../../../core/schemas/componentSchemas.js';
import { runSuggestionPreprocessing } from '../../scraping/services/suggestionPreprocessor.js';

export class ComponentController {
  private componentService = new ComponentService();

  // --- Public Methods ---

  async getComponents(c: Context) {
    const category = c.req.query('category');
    const socket = c.req.query('socket');
    const ram_type = c.req.query('ram_type');
    const brand = c.req.query('brand');
    const search = c.req.query('search');
    const idsParam = c.req.query('ids');
    const inStock = c.req.query('in_stock') === 'true' ? true : c.req.query('in_stock') === 'false' ? false : undefined;
    const page = c.req.query('page') ? Number(c.req.query('page')) : 1;
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : 20;

    if (idsParam) {
      const ids = idsParam.split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);
      if (ids.length > 0) {
        const capped = ids.slice(0, 50);
        const components = await this.componentService.getComponentsByIds(capped);
        return c.json({ components, total: components.length });
      }
    }

    if (limit > 100) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Limit cannot exceed 100' } }, 400);
    }

    const { components, total } = await this.componentService.getComponents({
      category, socket, ram_type, brand, search, page, limit, in_stock: inStock,
    });

    c.header('X-Total-Count', String(total));
    return c.json({ components, total });
  }

  async smartSearch(c: Context) {
    const category = c.req.query('category');
    const search = c.req.query('search');
    const brand = c.req.query('brand');
    const socket = c.req.query('socket');
    const ram_type = c.req.query('ram_type');
    const sort = c.req.query('sort') ?? 'smart';
    const minPrice = c.req.query('min_price') ? Number(c.req.query('min_price')) : null;
    const maxPrice = c.req.query('max_price') ? Number(c.req.query('max_price')) : null;
    const min_wattage = c.req.query('min_wattage') ? Number(c.req.query('min_wattage')) : null;
    const max_wattage = c.req.query('max_wattage') ? Number(c.req.query('max_wattage')) : null;
    const min_capacity_gb = c.req.query('min_capacity') ? Number(c.req.query('min_capacity')) : null;
    const max_capacity_gb = c.req.query('max_capacity') ? Number(c.req.query('max_capacity')) : null;
    const min_frequency_mhz = c.req.query('min_freq') ? Number(c.req.query('min_freq')) : null;
    const max_frequency_mhz = c.req.query('max_freq') ? Number(c.req.query('max_freq')) : null;
    const inStockOnly = c.req.query('in_stock') === 'true';
    const compatibleOnly = c.req.query('compatible_only') === 'true';
    const vramGb = c.req.query('vram_gb') ? Number(c.req.query('vram_gb')) : undefined;
    const chipset = c.req.query('chipset');
    const form_factor = c.req.query('form_factor');
    const interface_type = c.req.query('interface_type');
    const efficiency_rating = c.req.query('efficiency_rating');
    const modular = c.req.query('modular');
    const core_count = c.req.query('core_count') ? Number(c.req.query('core_count')) : undefined;
    const page = c.req.query('page') ? Number(c.req.query('page')) : 1;
    const limit = Math.min(100, c.req.query('limit') ? Number(c.req.query('limit')) : 20);

    if (!category) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'The category parameter is required' } }, 400);
    }

    let currentBuild: Record<string, any> = {};
    try {
      const body = await c.req.json();
      if (body && typeof body.build === 'object') {
        currentBuild = body.build;
      }
    } catch { }

    const result = await this.componentService.smartSearch({
      category, search, brand, socket, ram_type, sort, minPrice, maxPrice, inStockOnly, compatibleOnly, vramGb, page, limit, currentBuild,
      min_wattage, max_wattage, min_capacity_gb, max_capacity_gb, min_frequency_mhz, max_frequency_mhz,
      chipset, form_factor, interface_type, efficiency_rating, modular, core_count
    });



    c.header('X-Total-Count', String(result.total));
    return c.json(result);
  }

  async getComponentBySlug(c: Context) {
    const slug = c.req.param('slug');
    const component = await this.componentService.getComponentBySlug(slug);
    return c.json(component);
  }

  async getComponentById(c: Context) {
    const id = Number(c.req.param('id'));
    if (!id) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } }, 400);
    const component = await this.componentService.getComponentById(id);
    return c.json(component);
  }

  async getPrices(c: Context) {
    const id = Number(c.req.param('id'));
    if (!id) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } }, 400);
    const prices = await this.componentService.getPricesByComponentId(id);
    return c.json({ offers: prices });
  }

  async getPriceHistory(c: Context) {
    const id = Number(c.req.param('id'));
    const days = c.req.query('days') ? Number(c.req.query('days')) : 30;
    if (!id) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } }, 400);
    const history = await this.componentService.getPriceHistory(id, days);
    return c.json({ component_id: id, history });
  }

  // --- Admin Methods ---

  async getAdminComponents(c: Context) {
    const category = c.req.query('category');
    const search = c.req.query('search');
    const isActiveRaw = c.req.query('is_active');
    const page = c.req.query('page') ? Number(c.req.query('page')) : 1;
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : 20;

    const include_inactive = isActiveRaw === undefined ? true : undefined;
    const is_active_filter = isActiveRaw === 'true' ? true : isActiveRaw === 'false' ? false : undefined;

    const { components, total } = await this.componentService.getComponents({
      category: category || undefined,
      search: search || undefined,
      page,
      limit,
      include_inactive: include_inactive,
      is_active: is_active_filter,
    });

    c.header('X-Total-Count', String(total));
    return c.json({ components, total });
  }

  async createComponent(c: Context) {
    const data = c.get('validatedBody') as ComponentInput;
    const admin = c.get('admin') as { id: number } | undefined;

    const component = await this.componentService.createComponent(data);

    if (admin?.id) {
      await logActivity(admin.id, 'component_created', 'component', component.id, { name: component.name });
    }

    return c.json(component, 201);
  }

  async updateComponent(c: Context) {
    const id = Number(c.req.param('id'));
    if (!id) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } }, 400);

    const data = c.get('validatedBody') as ComponentInput;
    const admin = c.get('admin') as { id: number } | undefined;

    const component = await this.componentService.updateComponent(id, data);

    if (admin?.id) {
      await logActivity(admin.id, 'component_updated', 'component', id);
    }

    return c.json(component);
  }

  async deleteComponent(id: number) {
    const idNum = Number(id);
    const admin = c.get('admin') as { id: number } | undefined;

    await this.componentService.deleteComponent(idNum);

    if (admin?.id) {
      await logActivity(admin.id, 'component_deleted', 'component', idNum);
    }

    return c.json({ message: `Component ${idNum} deleted successfully.` });
  }

  async deactivateComponent(c: Context) {
    const id = Number(c.req.param('id'));
    if (!id) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } }, 400);

    const admin = c.get('admin') as { id: number } | undefined;

    const component = await this.componentService.deactivateComponent(id);

    if (admin?.id) {
      await logActivity(admin.id, 'component_deactivated', 'component', id, { name: component.name });
    }

    return c.json({ message: `Component ${id} deactivated successfully.`, component });
  }

  async activateComponent(c: Context) {
    const id = Number(c.req.param('id'));
    if (!id) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } }, 400);

    const admin = c.get('admin') as { id: number } | undefined;
    
    const component = await this.componentService.activateComponent(id);

    if (admin?.id) {
      await logActivity(admin.id, 'component_activated', 'component', id, { name: component.name });
    }

    return c.json({ message: `Component ${id} activated successfully.` });
  }

  async unlinkComponent(c: Context) {
    const id = Number(c.req.param('id'));
    if (!id) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } }, 400);

    const admin = c.get('admin') as { id: number } | undefined;

    const result = await this.componentService.unlinkComponent(id);

    if (admin?.id) {
      await logActivity(admin.id, 'component_unlinked', 'component', id, result);
    }

    return c.json({ message: `Component ${id} unlinked. ${result.listings_reset} listing(s) reset to pending.`, ...result });
  }

  async importComponents(c: Context) {
    const admin = c.get('admin') as { id: number } | undefined;

    let rawData: Record<string, any>[] = [];
    try {
      const contentType = c.req.header('content-type') ?? '';

      if (contentType.includes('application/json')) {
        rawData = await c.req.json();
      } else {
        const formData = await c.req.formData();
        const file = formData.get('file');
        if (!file || typeof file === 'string') {
          return c.json({ error: { code: 'VALIDATION_ERROR', message: 'file field is required' } }, 400);
        }
        const text = await (file as any).text();
        const fileType = (file as any).name?.endsWith('.json') ? 'json' : 'csv';

        if (fileType === 'json') {
          rawData = JSON.parse(text);
        } else {
          const results = Papa.parse(text, { header: true, skipEmptyLines: true });
          if (results.errors.length > 0) {
            return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Malformed CSV', details: results.errors } }, 400);
          }
          rawData = results.data as Record<string, any>[];
        }
      }
    } catch (err) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Failed to parse import file' } }, 400);
    }

    if (!Array.isArray(rawData)) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Import data must be an array' } }, 400);
    }

    const results = {
      total_rows: rawData.length,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [] as { row: number; message: string; details?: any }[],
    };

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 1;

      try {
        const category = row.category as keyof typeof componentSchemas;
        if (!category || !componentSchemas[category]) {
          throw new Error(`Invalid or missing category: ${category}`);
        }

        const coercedRow = { ...row };
        const numericFields = [
          'tdp', 'wattage', 'length_mm', 'max_gpu_length_mm', 'max_ram_frequency',
          'frequency_mhz', 'release_year', 'max_cooler_height_mm', 'height_mm', 'benchmark_score',
          'ram_slots', 'm2_slots', 'sata_ports',
        ];
        for (const field of numericFields) {
          if (row[field] && typeof row[field] === 'string') {
            const val = parseFloat(row[field]);
            if (!isNaN(val)) coercedRow[field] = val;
          }
        }
        if (typeof row.supported_ram_types === 'string') {
          coercedRow.supported_ram_types = row.supported_ram_types.split('|').map((s: string) => s.trim()).filter(Boolean);
        }
        if (typeof row.supported_motherboards === 'string') {
          coercedRow.supported_motherboards = row.supported_motherboards.split('|').map((s: string) => s.trim()).filter(Boolean);
        }

        const schema = componentSchemas[category];
        const validated = schema.safeParse(coercedRow);
        if (!validated.success) {
          const msg = validated.error.issues.map((e) => `${String(e.path.join('.'))}: ${e.message}`).join(', ');
          throw new Error(`Validation failed: ${msg}`);
        }

        await this.componentService.createComponent(validated.data as any);
        results.imported++;
      } catch (err: any) {
        const isUniqueError = err instanceof Error && (err.message.toLowerCase().includes('unique') || err.code === '23505');
        if (isUniqueError) {
          results.skipped++;
        } else {
          results.failed++;
          const message = err instanceof Error ? err.message : String(err);
          results.errors.push({ row: rowNum, message });
        }
      }
    }

    if (admin?.id) {
      await logActivity(admin.id, 'import_completed', 'component', undefined, {
        imported: results.imported,
        skipped: results.skipped,
        failed: results.failed,
      });
    }

    if (results.imported > 0) {
      runSuggestionPreprocessing(true).catch(() => { });
    }

    return c.json(results);
  }
}
