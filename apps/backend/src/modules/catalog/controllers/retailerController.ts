import { Context } from 'hono';
import { RetailerService } from '../services/retailerService.js';
import { logActivity } from '../../admin/services/adminService.js';
import { getSql } from '../../../core/db/index.js';
import { AppError } from '../../../core/errors/errors.js';

export class RetailerController {
  private service = new RetailerService();

  async index(c: Context) {
    const includeInactive = c.req.query('include_inactive') === 'true';
    const retailers = await this.service.getRetailers(includeInactive);
    return c.json({ retailers });
  }

  async create(c: Context) {
    const admin = c.get('admin') as { id: number } | undefined;
    const body = await c.req.json();

    if (!body.name || !body.base_url) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'name and base_url are required' } }, 400);
    }

    const retailer = await this.service.createRetailer(body);

    if (admin?.id) {
      await logActivity(admin.id, 'retailer_created', 'retailer', retailer.id, { name: retailer.name });
    }

    return c.json(retailer, 201);
  }

  async update(c: Context) {
    const id = Number(c.req.param('id'));
    const admin = c.get('admin') as { id: number } | undefined;
    const body = await c.req.json();

    const retailer = await this.service.updateRetailer(id, body);

    if (admin?.id) {
      await logActivity(admin.id, 'retailer_updated', 'retailer', id);
    }

    return c.json(retailer);
  }

  async delete(c: Context) {
    const id = Number(c.req.param('id'));
    const admin = c.get('admin') as { id: number } | undefined;

    await this.service.updateRetailer(id, { is_active: false });

    if (admin?.id) {
      await logActivity(admin.id, 'retailer_deactivated', 'retailer', id);
    }

    return c.json({ message: `Retailer ${id} deactivated.` });
  }

  async hardDelete(c: Context) {
    const id = Number(c.req.param('id'));
    const admin = c.get('admin') as { id: number } | undefined;
    const sql = getSql();

    const retailer = await this.service.getRetailerById(id);
    if (retailer.is_active) {
      throw new AppError('RETAILER_ACTIVE', 'Deactivate the retailer before deleting it', 409);
    }

    // Cascade delete
    await sql`DELETE FROM prices WHERE retailer_id = ${id}`;
    await sql`DELETE FROM scraper_mappings WHERE retailer_id = ${id}`;
    await sql`DELETE FROM unmatched_listings WHERE retailer_id = ${id}`;
    await sql`DELETE FROM scraper_logs WHERE site = ${retailer.name}`;
    await sql`DELETE FROM retailers WHERE id = ${id}`;

    if (admin?.id) {
      await logActivity(admin.id, 'retailer_deleted', 'retailer', id, { name: retailer.name });
    }

    return c.json({ message: `Retailer ${id} permanently deleted.` });
  }
}
