/**
 * Public compatibility route
 *
 * POST /api/compatibility/validate — validate a PC build, return errors and warnings
 *
 * Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3
 */

import { Hono } from 'hono';
import { validateCompatibility } from '../services/compatibilityService.js';

const compatibilityRouter = new Hono();

// POST /api/compatibility/validate
compatibilityRouter.post('/validate', async (c) => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Le corps de la requête doit être du JSON valide', fields: [] } },
      400,
    );
  }

  if (body === null || typeof body !== 'object') {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Le corps de la requête doit être un objet', fields: [] } },
      400,
    );
  }

  // validateCompatibility accepts a partial build — all fields optional
  const result = validateCompatibility(body as Parameters<typeof validateCompatibility>[0]);

  return c.json(result);
});

export { compatibilityRouter };
