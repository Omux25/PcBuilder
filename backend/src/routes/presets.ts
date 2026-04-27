/**
 * Public preset build routes
 *
 * GET /api/builds/presets          — list all active preset builds
 * GET /api/builds/presets/:id      — single preset build by ID
 *
 * Requirements: 10.1, 10.5
 */

import { Hono } from 'hono';
import { getPresets, getPresetById } from '../services/presetService.js';

const presetsRouter = new Hono();

// GET /api/builds/presets?use_case=gaming
presetsRouter.get('/', async (c) => {
  const useCase = c.req.query('use_case');
  const presets = await getPresets(useCase);
  return c.json({ presets });
});

// GET /api/builds/presets/:id
presetsRouter.get('/:id', async (c) => {
  const raw = c.req.param('id');
  const id  = Number(raw);

  if (!Number.isInteger(id) || id <= 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } },
      400,
    );
  }

  try {
    const preset = await getPresetById(id);
    return c.json(preset);
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'PRESET_NOT_FOUND') {
      return c.json({ error: { code: 'NOT_FOUND', message: err.message } }, 404);
    }
    throw err;
  }
});

export { presetsRouter };
