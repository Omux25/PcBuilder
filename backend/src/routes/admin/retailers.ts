/**
 * Admin retailer routes — JWT-protected
 *
 * GET    /api/admin/retailers      — list all retailers with stats
 * POST   /api/admin/retailers      — create a retailer
 * PUT    /api/admin/retailers/:id  — update a retailer
 * DELETE /api/admin/retailers/:id  — deactivate a retailer
 *
 * Requirements: 4.1, 4.3, 4.5
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { getRetailers, getRetailerById, createRetailer, updateRetailer } from '../../services/retailerService.js';
import { logActivity } from '../../services/adminService.js';

const adminRetailersRouter = new Hono();

adminRetailersRouter.use('/*', authMiddleware);

// GET /api/admin/retailers
adminRetailersRouter.get('/', async (c) => {
  const retailers = await getRetailers(true); // include inactive
  return c.json({ retailers });
});

// POST /api/admin/retailers
adminRetailersRouter.post('/', async (c) => {
  const admin = c.get('admin') as { id: number } | undefined;

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, 400);
  }

  if (!body.name || typeof body.name !== 'string') {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } }, 400);
  }
  if (!body.base_url || typeof body.base_url !== 'string') {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'base_url is required' } }, 400);
  }

  const retailer = await createRetailer({
    name: body.name,
    base_url: body.base_url,
    logo_url: body.logo_url as string | undefined,
    country: body.country as string | undefined,
    scraping_interval_hours: body.scraping_interval_hours as number | undefined,
    notes: body.notes as string | undefined,
  });

  if (admin?.id) {
    await logActivity(admin.id, 'retailer_created', 'retailer', retailer.id, { name: retailer.name });
  }

  return c.json(retailer, 201);
});

// PUT /api/admin/retailers/:id
adminRetailersRouter.put('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } }, 400);
  }

  const admin = c.get('admin') as { id: number } | undefined;

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, 400);
  }

  try {
    const retailer = await updateRetailer(id, {
      name: body.name as string | undefined,
      base_url: body.base_url as string | undefined,
      logo_url: body.logo_url as string | undefined,
      country: body.country as string | undefined,
      is_active: body.is_active as boolean | undefined,
      scraping_interval_hours: body.scraping_interval_hours as number | undefined,
      notes: body.notes as string | undefined,
    });

    if (admin?.id) {
      await logActivity(admin.id, 'retailer_updated', 'retailer', id);
    }

    return c.json(retailer);
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'RETAILER_NOT_FOUND') {
      return c.json({ error: { code: 'NOT_FOUND', message: err.message } }, 404);
    }
    throw err;
  }
});

// DELETE /api/admin/retailers/:id — soft delete (set is_active = false)
adminRetailersRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } }, 400);
  }

  const admin = c.get('admin') as { id: number } | undefined;

  try {
    await updateRetailer(id, { is_active: false });

    if (admin?.id) {
      await logActivity(admin.id, 'retailer_deactivated', 'retailer', id);
    }

    return c.json({ message: `Retailer ${id} deactivated.` });
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'RETAILER_NOT_FOUND') {
      return c.json({ error: { code: 'NOT_FOUND', message: err.message } }, 404);
    }
    throw err;
  }
});

export { adminRetailersRouter };
