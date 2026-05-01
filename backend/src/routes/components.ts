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
import { getComponents, getComponentById, getComponentsByIds, getComponentBySlug, getPricesByComponentId } from '../services/componentService.js';
import { getPriceHistory } from '../services/priceHistoryService.js';
import { validateCompatibility } from '../services/compatibilityService.js';
import { getSql } from '../db/index.js';
import { AppError } from '../utils/errors.js';

const componentsRouter = new Hono();

// GET /api/components?category=cpu&socket=AM5&ram_type=DDR5&brand=AMD&search=ryzen&page=1&limit=20
componentsRouter.get('/', async (c) => {
  const category = c.req.query('category');
  const socket   = c.req.query('socket');
  const ram_type = c.req.query('ram_type');
  const brand    = c.req.query('brand');
  const search   = c.req.query('search');
  const idsParam = c.req.query('ids');
  const inStock  = c.req.query('in_stock') === 'true' ? true : c.req.query('in_stock') === 'false' ? false : undefined;
  const page     = c.req.query('page')  ? Number(c.req.query('page'))  : 1;
  const limit    = c.req.query('limit') ? Number(c.req.query('limit')) : 20;

  if (idsParam) {
    const ids = idsParam.split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);
    if (ids.length > 0) {
      const components = await getComponentsByIds(ids);
      return c.json({ components, total: components.length });
    }
  }

  if (limit > 100) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Limit cannot exceed 100' } },
      400,
    );
  }

  const { components, total } = await getComponents({
    category, socket, ram_type, brand, search, page, limit, in_stock: inStock,
  });

  c.header('X-Total-Count', String(total));
  return c.json({ components, total });
});

// POST /api/components/smart-search
componentsRouter.post('/smart-search', async (c) => {
  const category = c.req.query('category');
  const search   = c.req.query('search');
  const brand    = c.req.query('brand');
  const socket   = c.req.query('socket');
  const ram_type = c.req.query('ram_type');
  const page     = c.req.query('page')  ? Number(c.req.query('page'))  : 1;
  const limit    = Math.min(100, c.req.query('limit') ? Number(c.req.query('limit')) : 20);

  if (!category) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'The category parameter is required' } }, 400);
  }

  let currentBuild: Record<string, unknown> = {};
  try {
    const body = await c.req.json();
    if (body && typeof body.build === 'object') {
      currentBuild = body.build;
    }
  } catch { }

  const { components } = await getComponents({
    category,
    search:   search   || undefined,
    brand:    brand    || undefined,
    socket:   socket   || undefined,
    ram_type: ram_type || undefined,
    page: 1,
    limit: 300,
  });

  if (components.length === 0) return c.json({ components: [], total: 0 });

  const priceRows = await getSql()`
    SELECT
      p.component_id,
      MIN(p.price) FILTER (WHERE p.in_stock = true) AS lowest_in_stock_price,
      MIN(p.price)                                   AS lowest_any_price,
      BOOL_OR(p.in_stock)                            AS any_in_stock
    FROM prices p
    JOIN components c ON c.id = p.component_id
    WHERE c.category = ${category}
      AND c.is_active = true
    GROUP BY p.component_id
  ` as { component_id: number; lowest_in_stock_price: number | null; lowest_any_price: number; any_in_stock: boolean }[];

  const priceMap = new Map(priceRows.map((r) => [r.component_id, r]));

  const enriched = components.map((component) => {
    const priceData = priceMap.get(component.id);
    const lowest_price = priceData ? Number(priceData.lowest_in_stock_price ?? priceData.lowest_any_price) : null;
    const in_stock = priceData ? priceData.any_in_stock : false;
    const testBuild = { ...currentBuild, [category]: component };

    let compatibility: 'compatible' | 'incompatible' | 'unknown' = 'unknown';
    let compatibility_issues: string[] = [];
    const hasOtherComponents = Object.keys(currentBuild).some((k) => k !== category);

    if (hasOtherComponents) {
      try {
        const result = validateCompatibility(testBuild as Parameters<typeof validateCompatibility>[0]);
        const relevantErrors = result.errors.filter((e) => e.components.includes(category));
        if (relevantErrors.length > 0) {
          compatibility = 'incompatible';
          compatibility_issues = relevantErrors.map((e) => e.message);
        } else {
          compatibility = 'compatible';
        }
      } catch {
        compatibility = 'unknown';
      }
    } else {
      compatibility = 'compatible';
    }

    return { ...component, lowest_price, in_stock, compatibility, compatibility_issues };
  });

  enriched.sort((a, b) => {
    if (a.compatibility === 'incompatible' && b.compatibility !== 'incompatible') return 1;
    if (b.compatibility === 'incompatible' && a.compatibility !== 'incompatible') return -1;
    if (a.in_stock && !b.in_stock) return -1;
    if (!a.in_stock && b.in_stock) return 1;
    if (a.lowest_price !== null && b.lowest_price !== null) return a.lowest_price - b.lowest_price;
    if (a.lowest_price !== null) return -1;
    if (b.lowest_price !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  const total = enriched.length;
  const start = (page - 1) * limit;
  const paginated = enriched.slice(start, start + limit);

  c.header('X-Total-Count', String(total));
  return c.json({ components: paginated, total });
});

// GET /api/components/slug/:slug — MUST be before /:id so 'slug' is not parsed as a number
componentsRouter.get('/slug/:slug', async (c) => {
  const slug = c.req.param('slug');

  try {
    const component = await getComponentBySlug(slug);
    return c.json(component);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
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
      { error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } },
      400,
    );
  }

  const retailerId = c.req.query('retailer_id') ? Number(c.req.query('retailer_id')) : undefined;
  const days       = c.req.query('days')        ? Number(c.req.query('days'))        : 30;

  try {
    const history = await getPriceHistory(id, retailerId, days);
    return c.json({ component_id: id, history });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }
    throw err;
  }
});

// GET /api/components/:id/prices
componentsRouter.get('/:id/prices', async (c) => {
  const raw = c.req.param('id');
  const id  = Number(raw);

  if (!Number.isInteger(id) || id <= 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } },
      400,
    );
  }

  // Verify the component exists first
  try {
    await getComponentById(id);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }
    throw err;
  }

  const offers = await getPricesByComponentId(id);

  return c.json({
    offers,
    message: offers.length === 0
      ? 'This component is not available from any referenced retailer.'
      : undefined,
  });
});

componentsRouter.get('/:id', async (c) => {
  const raw = c.req.param('id');
  const id  = Number(raw);

  if (!Number.isInteger(id) || id <= 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } },
      400,
    );
  }

  try {
    const component = await getComponentById(id);
    return c.json(component);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }
    throw err;
  }
});

export { componentsRouter };
