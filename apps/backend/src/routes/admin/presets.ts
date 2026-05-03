/**
 * Admin preset build routes — JWT-protected
 *
 * GET    /api/admin/presets      — list all presets (including inactive)
 * POST   /api/admin/presets      — create a preset
 * PUT    /api/admin/presets/:id  — update a preset
 * DELETE /api/admin/presets/:id  — delete a preset
 *
 * Requirements: 10.2
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { getPresets, createPreset, updatePreset, deletePreset } from '../../services/presetService.js';
import { logActivity } from '../../services/adminService.js';
import { AppError } from '../../utils/errors.js';
import type { AdminEnv } from './types.js';
import { parseId } from './types.js';

const adminPresetsRouter = new Hono<AdminEnv>();

adminPresetsRouter.use('/*', authMiddleware);

const VALID_USE_CASES = ['gaming', 'workstation', 'office', 'budget'] as const;

// GET /api/admin/presets
adminPresetsRouter.get('/', async (c) => {
  const presets = await getPresets(undefined, true); // include inactive for admin view
  return c.json({ presets });
});

// POST /api/admin/presets
adminPresetsRouter.post('/', async (c) => {
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
  if (!body.use_case || !VALID_USE_CASES.includes(body.use_case as typeof VALID_USE_CASES[number])) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: `use_case must be one of: ${VALID_USE_CASES.join(', ')}` } }, 400);
  }
  if (!body.components || typeof body.components !== 'object') {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'components map is required' } }, 400);
  }

  const preset = await createPreset({
    name: body.name,
    description: body.description as string | undefined,
    use_case: body.use_case as string,
    components: body.components as Record<string, number>,
  });

  if (admin?.id) {
    await logActivity(admin.id, 'preset_created', 'preset_build', preset.id, { name: preset.name });
  }

  return c.json(preset, 201);
});

// PUT /api/admin/presets/:id
adminPresetsRouter.put('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) {
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
    const preset = await updatePreset(id, {
      name: body.name as string | undefined,
      description: body.description as string | undefined,
      use_case: body.use_case as string | undefined,
      components: body.components as Record<string, number> | undefined,
    });

    if (admin?.id) {
      await logActivity(admin.id, 'preset_updated', 'preset_build', id);
    }

    return c.json(preset);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }
    throw err;
  }
});

// DELETE /api/admin/presets/:id
adminPresetsRouter.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } }, 400);
  }

  const admin = c.get('admin') as { id: number } | undefined;

  try {
    await deletePreset(id);

    if (admin?.id) {
      await logActivity(admin.id, 'preset_deleted', 'preset_build', id);
    }

    return c.json({ message: `Preset build ${id} deleted.` });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }
    throw err;
  }
});

export { adminPresetsRouter };
