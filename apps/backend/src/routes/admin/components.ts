/**
 * Admin component routes — JWT-protected
 *
 * GET    /api/admin/components              — list all components (including inactive)
 * POST   /api/admin/components              — create a component
 * PUT    /api/admin/components/:id          — update a component
 * DELETE /api/admin/components/:id          — hard-delete (409 if has dependencies)
 * POST   /api/admin/components/:id/deactivate — soft-delete (sets is_active = false)
 * POST   /api/admin/components/import       — bulk import from CSV or JSON
 *
 * Requirements: 6.1–6.7, 8.1–8.6
 */

import Papa from 'papaparse';
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { validateComponent } from '../../middleware/validate.js';
import {
  getComponents,
  createComponent,
  updateComponent,
  deleteComponent,
  deactivateComponent,
} from '../../services/componentService.js';
import { logActivity } from '../../services/adminService.js';
import { AppError } from '../../utils/errors.js';
import { componentSchemas } from '../../schemas/componentSchemas.js';
import type { ComponentInput } from '../../schemas/componentSchemas.js';
import type { AdminEnv } from './types.js';
import { parseId } from './types.js';

const adminComponentsRouter = new Hono<AdminEnv>();

adminComponentsRouter.use('/*', authMiddleware);

// ── GET /api/admin/components ────────────────────────────────────────────────

adminComponentsRouter.get('/', async (c) => {
  const category    = c.req.query('category');
  const search      = c.req.query('search');
  const isActiveRaw = c.req.query('is_active');
  const page        = c.req.query('page')  ? Number(c.req.query('page'))  : 1;
  const limit       = c.req.query('limit') ? Number(c.req.query('limit')) : 20;

  // Admin sees all components by default.
  // ?is_active=true  → active only
  // ?is_active=false → inactive only
  // (omitted)        → all (include_inactive overrides the default active-only filter)
  const include_inactive = isActiveRaw === undefined ? true : undefined;
  const is_active_filter = isActiveRaw === 'true' ? true : isActiveRaw === 'false' ? false : undefined;

  const { components, total } = await getComponents({
    category:         category || undefined,
    search:           search   || undefined,
    page,
    limit,
    include_inactive: include_inactive,
    is_active:        is_active_filter,
  });

  c.header('X-Total-Count', String(total));
  return c.json({ components, total });
});

// ── POST /api/admin/components ───────────────────────────────────────────────

adminComponentsRouter.post('/', validateComponent, async (c) => {
  const data    = c.get('validatedBody') as ComponentInput;
  const admin   = c.get('admin') as { id: number } | undefined;

  const component = await createComponent(data);

  if (admin?.id) {
    await logActivity(admin.id, 'component_created', 'component', component.id, { name: component.name });
  }

  return c.json(component, 201);
});

// ── PUT /api/admin/components/:id ────────────────────────────────────────────

adminComponentsRouter.put('/:id', validateComponent, async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } }, 400);
  }

  const data  = c.get('validatedBody') as ComponentInput;
  const admin = c.get('admin') as { id: number } | undefined;

  try {
    const component = await updateComponent(id, data);

    if (admin?.id) {
      await logActivity(admin.id, 'component_updated', 'component', id);
    }

    return c.json(component);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }
    throw err;
  }
});

// ── DELETE /api/admin/components/:id ─────────────────────────────────────────

adminComponentsRouter.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } }, 400);
  }

  const admin = c.get('admin') as { id: number } | undefined;

  try {
    await deleteComponent(id);

    if (admin?.id) {
      await logActivity(admin.id, 'component_deleted', 'component', id);
    }

    return c.json({ message: `Component ${id} deleted successfully.` });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }
    throw err;
  }
});

// ── POST /api/admin/components/:id/deactivate ─────────────────────────────────
// Soft-delete: sets is_active = false. The component is hidden from the public
// API but its price history and scraper mappings are preserved.
// Use this instead of DELETE when the component has linked records.

adminComponentsRouter.post('/:id/deactivate', async (c) => {
  const id = parseId(c.req.param('id'));
  if (id === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } }, 400);
  }

  const admin = c.get('admin') as { id: number } | undefined;

  try {
    const component = await deactivateComponent(id);

    if (admin?.id) {
      await logActivity(admin.id, 'component_deactivated', 'component', id, { name: component.name });
    }

    return c.json({ message: `Component ${id} deactivated successfully.`, component });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }
    throw err;
  }
});

// ── POST /api/admin/components/import ────────────────────────────────────────

adminComponentsRouter.post('/import', async (c) => {
  const admin = c.get('admin') as { id: number } | undefined;

  let rawData: Record<string, unknown>[] = [];
  try {
    const contentType = c.req.header('content-type') ?? '';

    if (contentType.includes('application/json')) {
      rawData = await c.req.json();
    } else {
      const formData = await c.req.formData();
      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'file field is required' } }, 400);
      }
      const text = await (file as File).text();
      const fileType = (file as File).name?.endsWith('.json') ? 'json' : 'csv';

      if (fileType === 'json') {
        rawData = JSON.parse(text);
      } else {
        const results = Papa.parse(text, { header: true, skipEmptyLines: true });
        if (results.errors.length > 0) {
          return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Malformed CSV', details: results.errors } }, 400);
        }
        rawData = results.data as Record<string, unknown>[];
      }
    }
  } catch (err) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Failed to parse import file' } }, 400);
  }

  if (!Array.isArray(rawData)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Import data must be an array' } }, 400);
  }

  const results = {
    total_rows: rawData.length,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [] as { row: number; message: string; details?: unknown }[],
  };

  // Process row-by-row with per-row error handling.
  // Note: createComponent() uses getSql() internally, so a transaction cannot
  // be threaded through without a large service-layer refactor. Row-by-row is
  // the honest behavior — each row either succeeds or is counted as failed/skipped.
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const rowNum = i + 1;

    try {
      // 1. Basic validation (category presence)
      const category = row.category as keyof typeof componentSchemas;
      if (!category || !componentSchemas[category]) {
        throw new Error(`Invalid or missing category: ${category}`);
      }

      // 2. Data Coercion (CSV values are strings, Zod needs numbers for some fields)
      const coercedRow = { ...row };
      const numericFields = [
        'tdp', 'wattage', 'length_mm', 'max_gpu_length_mm', 'max_ram_frequency',
        'frequency_mhz', 'release_year', 'max_cooler_height_mm', 'height_mm', 'benchmark_score',
      ];
      for (const field of numericFields) {
        if (row[field] && typeof row[field] === 'string') {
          const val = parseFloat(row[field]);
          if (!isNaN(val)) coercedRow[field] = val;
        }
      }
      if (typeof row.supported_ram_types === 'string') {
        coercedRow.supported_ram_types = row.supported_ram_types.split('|').map((s: string) => s.trim()).filter(Boolean);
      }
      if (typeof row.supported_motherboards === 'string') {
        coercedRow.supported_motherboards = row.supported_motherboards.split('|').map((s: string) => s.trim()).filter(Boolean);
      }

      // 3. Zod Validation
      const schema = componentSchemas[category];
      const validated = schema.safeParse(coercedRow);
      if (!validated.success) {
        const msg = validated.error.issues.map((e) => `${String(e.path.join('.'))}: ${e.message}`).join(', ');
        throw new Error(`Validation failed: ${msg}`);
      }

      // 4. Persistence
      await createComponent(validated.data as unknown as ComponentInput);
      results.imported++;
    } catch (err: unknown) {
      // Check for unique constraint (slug collision)
      const isUniqueError = err instanceof Error && (err.message.toLowerCase().includes('unique') || (err as { code?: string }).code === '23505');
      if (isUniqueError) {
        results.skipped++;
      } else {
        results.failed++;
        const message = err instanceof Error ? err.message : String(err);
        results.errors.push({ row: rowNum, message });
      }
    }
  }

  if (admin?.id) {
    await logActivity(admin.id, 'import_completed', 'component', undefined, {
      imported: results.imported,
      skipped: results.skipped,
      failed: results.failed,
    });
  }

  return c.json(results);
});

export { adminComponentsRouter };
