/**
 * Public compatibility route
 *
 * POST /api/compatibility/validate — validate a PC build, return errors and warnings
 *
 * Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3
 */

import { Hono } from 'hono';
import { z } from 'zod/v4';
import { validateCompatibility } from '../services/compatibilityService.js';

const compatibilityRouter = new Hono();

// ── Input schema ──────────────────────────────────────────────────────────────
// Each slot is optional. When present, only the fields the engine actually reads
// are validated — extra fields are stripped by .strip() (Zod v4 default).
// This prevents a client sending { cpu: "string" } from silently skipping rules.

const componentSlotSchema = z.object({
  socket:                z.string().optional(),
  supported_ram_types:   z.array(z.string()).optional(),
  max_ram_frequency:     z.number().optional(),
  ram_type:              z.string().optional(),
  frequency_mhz:         z.number().optional(),
  length_mm:             z.number().optional(),
  max_gpu_length_mm:     z.number().optional(),
  supported_motherboards:z.array(z.string()).optional(),
  max_cooler_height_mm:  z.number().optional(),
  form_factor:           z.string().optional(),
  height_mm:             z.number().optional(),
  wattage:               z.number().optional(),
  tdp:                   z.number().nullable().optional(),
  specs:                 z.record(z.unknown()).optional(),
}).passthrough();

const buildSchema = z.object({
  cpu:         componentSlotSchema.optional(),
  motherboard: componentSlotSchema.optional(),
  gpu:         componentSlotSchema.optional(),
  ram:         componentSlotSchema.optional(),
  storage:     componentSlotSchema.optional(),
  psu:         componentSlotSchema.optional(),
  case:        componentSlotSchema.optional(),
  cooling:     componentSlotSchema.optional(),
});

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

  const parsed = buildSchema.safeParse(body);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid build configuration', fields } },
      400,
    );
  }

  const result = validateCompatibility(parsed.data as Parameters<typeof validateCompatibility>[0]);

  return c.json(result);
});

export { compatibilityRouter };
