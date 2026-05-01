/**
 * Admin unmatched listings routes — JWT-protected
 *
 * GET  /api/admin/unmatched-listings          — list unmatched scraped products
 * POST /api/admin/unmatched-listings/:id/link — link to a component
 * POST /api/admin/unmatched-listings/:id/dismiss — dismiss the listing
 *
 * Requirements: 2.3, 2.4, 5.5
 */

import { Hono } from 'hono';
import { getSql } from '../../db/index.js';
import { authMiddleware } from '../../middleware/auth.js';
import { logActivity } from '../../services/adminService.js';
import type { AdminEnv } from './types.js';
import { parseId } from './types.js';

const adminUnmatchedRouter = new Hono<AdminEnv>();

adminUnmatchedRouter.use('/*', authMiddleware);

// GET /api/admin/unmatched-listings?status=pending&retailer_id=1
adminUnmatchedRouter.get('/', async (c) => {
  const sql = getSql();
  const status     = c.req.query('status');
  const retailerId = c.req.query('retailer_id') ? Number(c.req.query('retailer_id')) : undefined;

  const rows = await sql`
    SELECT
      ul.*,
      r.name AS retailer_name
    FROM unmatched_listings ul
    JOIN retailers r ON r.id = ul.retailer_id
    WHERE (${status ?? null}::text IS NULL OR ul.status = ${status ?? null})
      AND (${retailerId ?? null}::int IS NULL OR ul.retailer_id = ${retailerId ?? null})
    ORDER BY ul.scraped_at DESC
    LIMIT 200
  `;

  return c.json({ listings: rows });
});

// POST /api/admin/unmatched-listings/:id/link
adminUnmatchedRouter.post('/:id/link', async (c) => {
  const sql = getSql();
  const id = parseId(c.req.param('id'));
  const admin = c.get('admin') as { id: number } | undefined;

  if (id === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, 400);
  }

  const componentId = Number(body.component_id);
  if (!Number.isInteger(componentId) || componentId <= 0) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'component_id must be a positive integer' } }, 400);
  }

  // Fetch the unmatched listing
  const listings = await sql`
    SELECT * FROM unmatched_listings WHERE id = ${id} LIMIT 1
  ` as { id: number; retailer_id: number; product_url: string; status: string }[];

  if (listings.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Unmatched listing ${id} not found` } }, 404);
  }

  const listing = listings[0];

  // Verify component exists
  const components = await sql`SELECT id FROM components WHERE id = ${componentId} LIMIT 1` as { id: number }[];
  if (components.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Component ${componentId} not found` } }, 404);
  }

  // Create scraper mapping
  const mappings = await sql`
    INSERT INTO scraper_mappings (component_id, retailer_id, product_url)
    VALUES (${componentId}, ${listing.retailer_id}, ${listing.product_url})
    ON CONFLICT (retailer_id, product_url) DO UPDATE SET component_id = ${componentId}, updated_at = NOW()
    RETURNING id
  ` as { id: number }[];

  // Update listing status
  await sql`
    UPDATE unmatched_listings
    SET status = 'linked', linked_component_id = ${componentId}
    WHERE id = ${id}
  `;

  if (admin?.id) {
    await logActivity(admin.id, 'unmatched_linked', 'scraper_mapping', mappings[0].id, {
      component_id: componentId,
      product_url: listing.product_url,
    });
  }

  return c.json({ success: true, scraper_mapping_id: mappings[0].id });
});

// POST /api/admin/unmatched-listings/:id/dismiss
adminUnmatchedRouter.post('/:id/dismiss', async (c) => {
  const sql = getSql();
  const id = parseId(c.req.param('id'));
  if (id === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } }, 400);
  }

  const rows = await sql`
    UPDATE unmatched_listings SET status = 'dismissed' WHERE id = ${id} RETURNING id
  ` as { id: number }[];

  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Unmatched listing ${id} not found` } }, 404);
  }

  return c.json({ success: true });
});

export { adminUnmatchedRouter };
