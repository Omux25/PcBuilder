/**
 * Public component routes
 *
 * GET /api/components                    — paginated list with optional filters
 * GET /api/components/:id                — single component by ID
 * GET /api/components/:id/price-history  — price history for a component
 *
 * Requirements: 1.2, 3.3, 8.4, 9.1, 9.2, 13.3, 13.4, 13.5
 */

import { Hono } from 'hono';
import { getComponents, getComponentById, getComponentBySlug } from '../services/componentService.js';
import { getPriceHistory } from '../services/priceHistoryService.js';

const componentsRouter = new Hono();

// GET /api/components?category=cpu&socket=AM5&ram_type=DDR5&brand=AMD&search=ryzen&page=1&limit=20
componentsRouter.get('/', async (c) => {
  const category = c.req.query('category');
  const socket   = c.req.query('socket');
  const ram_type = c.req.query('ram_type');
  const brand    = c.req.query('brand');
  const search   = c.req.query('search');
  const page     = c.req.query('page')  ? Number(c.req.query('page'))  : 1;
  const limit    = c.req.query('limit') ? Number(c.req.query('limit')) : 20;

  if (limit > 100) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'La limite ne peut pas dépasser 100' } },
      400,
    );
  }

  const { components, total } = await getComponents({
    category, socket, ram_type, brand, search, page, limit,
  });

  c.header('X-Total-Count', String(total));
  return c.json({ components, total });
});

// GET /api/components/slug/:slug — MUST be before /:id so 'slug' is not parsed as a number
componentsRouter.get('/slug/:slug', async (c) => {
  const slug = c.req.param('slug');

  try {
    const component = await getComponentBySlug(slug);
    return c.json(component);
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'COMPONENT_NOT_FOUND') {
      return c.json({ error: { code: 'NOT_FOUND', message: err.message } }, 404);
    }
    throw err;
  }
});

// GET /api/components/:id/price-history
componentsRouter.get('/:id/price-history', async (c) => {
  const raw = c.req.param('id');
  const id  = Number(raw);

  if (!Number.isInteger(id) || id <= 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'L\'identifiant doit être un entier positif' } },
      400,
    );
  }

  const retailerId = c.req.query('retailer_id') ? Number(c.req.query('retailer_id')) : undefined;
  const days       = c.req.query('days')        ? Number(c.req.query('days'))        : 30;

  try {
    const history = await getPriceHistory(id, retailerId, days);
    return c.json({ component_id: id, history });
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'COMPONENT_NOT_FOUND') {
      return c.json({ error: { code: 'NOT_FOUND', message: err.message } }, 404);
    }
    throw err;
  }
});

componentsRouter.get('/:id', async (c) => {
  const raw = c.req.param('id');
  const id  = Number(raw);

  if (!Number.isInteger(id) || id <= 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'L\'identifiant doit être un entier positif' } },
      400,
    );
  }

  try {
    const component = await getComponentById(id);
    return c.json(component);
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === 'COMPONENT_NOT_FOUND'
    ) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: err.message } },
        404,
      );
    }
    throw err;
  }
});

export { componentsRouter };
