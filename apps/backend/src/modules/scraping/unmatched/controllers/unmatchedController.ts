import type { Context } from 'hono';
import { UnmatchedService } from '../services/unmatchedService.js';
import { logActivity } from '../../../admin/services/adminService.js';
import { componentSchema } from '@shared/schemas/component.schema.js';

export class UnmatchedController {
  private service = new UnmatchedService();

  async index(c: Context) {
    const status = c.req.query('status');
    const retailerId = c.req.query('retailer_id') ? Number(c.req.query('retailer_id')) : undefined;
    const search = c.req.query('search');
    const category = c.req.query('category');
    const page = Math.max(1, Number(c.req.query('page') ?? 1) || 1);
    const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? 50) || 50));

    const result = await this.service.getListings({ status, retailerId, search, category, page, limit });
    c.header('X-Total-Count', String(result.total));
    return c.json(result);
  }

  async link(c: Context) {
    const id = Number(c.req.param('id'));
    const body = await c.req.json();
    const componentId = Number(body.component_id);
    const admin = c.get('admin') as { id: number } | undefined;

    if (!id || !componentId) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Missing id or component_id' } }, 400);
    }

    const mappingId = await this.service.linkListing(id, componentId);

    if (admin?.id) {
      await logActivity(admin.id, 'unmatched_linked', 'scraper_mapping', mappingId, {
        component_id: componentId,
      });
    }

    return c.json({ success: true, scraper_mapping_id: mappingId });
  }

  async dismiss(c: Context) {
    const id = Number(c.req.param('id'));
    if (!id) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } }, 400);

    await this.service.dismissListing(id);
    return c.json({ success: true });
  }

  async updateCategory(c: Context) {
    const id = Number(c.req.param('id'));
    const body = await c.req.json();
    if (!id) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } }, 400);

    await this.service.updateCategory(id, body.category);
    return c.json({ success: true });
  }

  async getByCategory(c: Context) {
    const categories = await this.service.getCategorySummary();
    return c.json({ categories });
  }

  async getGrouped(c: Context) {
    const search = c.req.query('search')?.trim();
    const retailerIdRaw = c.req.query('retailer_id');
    const retailerId = retailerIdRaw ? Number(retailerIdRaw) : null;
    const category = c.req.query('category')?.trim();
    const page = Math.max(1, Number(c.req.query('page') ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 50) || 50));
    const offsetParam = c.req.query('offset');
    const offset = offsetParam !== undefined ? Number(offsetParam) : undefined;

    const result = await this.service.getGroupedListings({ search, retailerId, category }, page, limit, offset);
    return c.json(result);
  }

  async reprocess(c: Context) {
    await this.service.reprocessSuggestions();
    return c.json({ message: 'Reprocessing started in background' }, 202);
  }

  async autoBuild(c: Context) {
    await this.service.autoBuild();
    return c.json({ message: 'Auto-build started in background' }, 202);
  }

  async bulkDismiss(c: Context) {
    const body = await c.req.json();
    const ids = body.listing_ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'listing_ids must be a non-empty array' } }, 400);
    }

    const dismissed = await this.service.bulkDismiss(ids);
    const skipped = ids.length - dismissed;
    return c.json({ dismissed, skipped });
  }

  async bulkApprove(c: Context) {
    const body = await c.req.json();
    const canonicalNames = body.canonical_names;
    if (!Array.isArray(canonicalNames) || canonicalNames.length === 0) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'canonical_names must be a non-empty array' } }, 400);
    }

    const admin = c.get('admin') as { id: number } | undefined;
    const result = await this.service.bulkApprove(canonicalNames);

    if (admin?.id) {
      await logActivity(admin.id, 'bulk_approve', 'unmatched_listings', undefined, result);
    }

    return c.json(result);
  }

  async createAndLink(c: Context) {
    const body = await c.req.json();
    const { name, brand, category, specs, listing_ids, link_to_existing, existing_component_id } = body;

    if (!name || !category || !Array.isArray(listing_ids) || listing_ids.length === 0) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } }, 400);
    }

    const resultBody = { name, brand, category, specs, listing_ids, link_to_existing, existing_component_id };
    const validated = componentSchema.safeParse(resultBody);
    if (!validated.success && !link_to_existing) {
       return c.json({ 
         error: { 
           code: 'VALIDATION_ERROR', 
           message: 'Validation failed', 
           fields: validated.error.issues.map((i: any) => i.path.join('.') || i.message)
         } 
       }, 400);
    }

    const admin = c.get('admin') as { id: number } | undefined;
    const result = await this.service.createAndLink({
      name, brand, category, specs, listing_ids, link_to_existing, existing_component_id
    });

    if (admin?.id) {
      await logActivity(admin.id, 'create_and_link', 'unmatched_listings', result.component_id, {
        linked_count: result.linked_count,
        link_to_existing
      });
    }

    return c.json(result, 201);
  }

  async reject(c: Context) {
    const body = await c.req.json();
    const ids = body.listing_ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'listing_ids must be a non-empty array' } }, 400);
    }

    const rejected = await this.service.bulkDismiss(ids);
    const admin = c.get('admin') as { id: number } | undefined;

    if (admin?.id && rejected > 0) {
      await logActivity(admin.id, 'reject_listings', 'unmatched_listings', undefined, {
        rejected,
        listing_ids: ids,
      });
    }

    return c.json({ rejected });
  }

  async bulkAssociate(c: Context) {
    const body = await c.req.json();
    const canonicalNames = body.canonical_names;
    if (!Array.isArray(canonicalNames) || canonicalNames.length === 0) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'canonical_names must be a non-empty array' } }, 400);
    }

    const admin = c.get('admin') as { id: number } | undefined;
    const result = await this.service.bulkApprove(canonicalNames);

    if (admin?.id) {
      // result from bulkApprove looks like { approved_groups, linked_listings, skipped_groups }
      await logActivity(admin.id, 'bulk_associate', 'unmatched_listings', undefined, result);
    }

    return c.json({ successful: [{ linked_count: result.linked_listings }], failed: [] }); 
  }

  async bulkCategory(c: Context) {
    const body = await c.req.json();
    const ids = body.listing_ids;
    const category = body.category; // can be string, null, or 'standby'
    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'listing_ids must be a non-empty array' } }, 400);
    }

    const count = await this.service.bulkUpdateCategory(ids, category);
    const admin = c.get('admin') as { id: number } | undefined;

    if (admin?.id && count > 0) {
      await logActivity(admin.id, 'bulk_category_update', 'unmatched_listings', undefined, {
        count,
        category,
        listing_ids: ids,
      });
    }

    return c.json({ success: true, count });
  }

  async bulkConfirmCategories(c: Context) {
    const admin = c.get('admin') as { id: number } | undefined;
    const result = await this.service.bulkConfirmAllWithCategories();

    if (admin?.id) {
      await logActivity(admin.id, 'bulk_confirm_categories', 'unmatched_listings', undefined, result);
    }

    return c.json(result);
  }
}
