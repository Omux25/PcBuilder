/**
 * Public compatibility route
 *
 * POST /api/compatibility/validate — validate a PC build, return errors and warnings
 *
 * Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { validateCompatibility } from '../services/compatibilityService.js';
import { getComponentsByIds } from '../services/componentService.js';

const compatibilityRouter = new Hono();

const buildIdSchema = z.record(z.string(), z.number().int().positive());

// POST /api/compatibility/validate
compatibilityRouter.post('/validate', async (c) => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON', fields: [] } },
      400,
    );
  }

  if (body === null || typeof body !== 'object') {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Request body must be an object', fields: [] } },
      400,
    );
  }

  const parsed = buildIdSchema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid build configuration: values must be component IDs', fields } },
      400,
    );
  }

  const componentIds = Array.from(new Set(Object.values(parsed.data)));
  const components = await getComponentsByIds(componentIds);
  const idMap = new Map(components.map(c => [c.id, c]));

  const buildInput: Record<string, unknown> = {};
  for (const [key, id] of Object.entries(parsed.data)) {
    const comp = idMap.get(id);
    if (comp) {
      buildInput[key] = comp;
    }
  }

  const result = validateCompatibility(buildInput as Parameters<typeof validateCompatibility>[0]);

  return c.json(result);
});

export { compatibilityRouter };
