/**
 * Public component routes
 *
 * GET /api/components          — list all components, optional filters
 * GET /api/components/:id      — single component by ID
 *
 * Requirements: 1.2, 8.4
 */

import { Hono } from 'hono';
import { getComponents, getComponentById } from '../services/componentService.js';

const componentsRouter = new Hono();

// GET /api/components?category=cpu&socket=AM5&ram_type=DDR5
componentsRouter.get('/', async (c) => {
  const category = c.req.query('category');
  const socket   = c.req.query('socket');
  const ram_type = c.req.query('ram_type');

  const components = await getComponents({ category, socket, ram_type });
  return c.json(components);
});

// GET /api/components/:id
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
