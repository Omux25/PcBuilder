/**
 * Public prices route
 *
 * GET /api/components/:id/prices — price offers for a component, sorted ascending
 *
 * Requirements: 7.1, 7.3, 7.4
 */

import { Hono } from 'hono';
import { getPricesByComponentId, getComponentById } from '../services/componentService.js';
import { AppError } from '../utils/errors.js';

const pricesRouter = new Hono();

// GET /api/components/:id/prices
pricesRouter.get('/:id/prices', async (c) => {
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
      return c.json(err.toJSON(), err.statusCode as any);
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

export { pricesRouter };
