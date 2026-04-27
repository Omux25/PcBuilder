/**
 * Admin component routes — JWT-protected
 *
 * POST   /api/admin/components       — create a component
 * PUT    /api/admin/components/:id   — update a component
 * DELETE /api/admin/components/:id   — delete a component
 *
 * Requirements: 8.1, 8.2, 8.3
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { validateComponent } from '../../middleware/validate.js';
import { createComponent, updateComponent, deleteComponent } from '../../services/componentService.js';

const adminComponentsRouter = new Hono();

// All routes in this file require a valid JWT
adminComponentsRouter.use('/*', authMiddleware);

// POST /api/admin/components
adminComponentsRouter.post('/', validateComponent, async (c) => {
  const data = c.get('validatedBody') as Record<string, unknown>;
  const component = await createComponent(data);
  return c.json(component, 201);
});

// PUT /api/admin/components/:id
adminComponentsRouter.put('/:id', validateComponent, async (c) => {
  const raw = c.req.param('id');
  const id  = Number(raw);

  if (!Number.isInteger(id) || id <= 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } },
      400,
    );
  }

  const data = c.get('validatedBody') as Record<string, unknown>;

  try {
    const component = await updateComponent(id, data);
    return c.json(component);
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === 'COMPONENT_NOT_FOUND'
    ) {
      return c.json({ error: { code: 'NOT_FOUND', message: err.message } }, 404);
    }
    throw err;
  }
});

// DELETE /api/admin/components/:id
adminComponentsRouter.delete('/:id', async (c) => {
  const raw = c.req.param('id');
  const id  = Number(raw);

  if (!Number.isInteger(id) || id <= 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } },
      400,
    );
  }

  try {
    await deleteComponent(id);
    return c.json({ message: `Component ${id} deleted successfully.` });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === 'COMPONENT_NOT_FOUND'
    ) {
      return c.json({ error: { code: 'NOT_FOUND', message: err.message } }, 404);
    }
    throw err;
  }
});

export { adminComponentsRouter };
