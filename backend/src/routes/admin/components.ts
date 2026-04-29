/**
 * Admin component routes — JWT-protected
 *
 * POST   /api/admin/components          — create a component
 * PUT    /api/admin/components/:id      — update a component
 * DELETE /api/admin/components/:id      — delete a component (409 if has dependencies)
 * POST   /api/admin/components/import   — bulk import from CSV or JSON
 *
 * Requirements: 6.1–6.7, 8.1–8.6
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { validateComponent } from '../../middleware/validate.js';
import {
  createComponent,
  updateComponent,
  deactivateComponent,
  deleteComponent,
} from '../../services/componentService.js';
import { logActivity } from '../../services/adminService.js';
import { AppError } from '../../utils/errors.js';
import type { ComponentInput } from '../../schemas/componentSchemas.js';

type AdminEnv = {
  Variables: {
    admin: { id: number };
    validatedBody: unknown;
  }
};

const adminComponentsRouter = new Hono<AdminEnv>();

adminComponentsRouter.use('/*', authMiddleware);

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
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
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
      return c.json(err.toJSON(), err.statusCode as any);
    }
    throw err;
  }
});

// ── DELETE /api/admin/components/:id ─────────────────────────────────────────

adminComponentsRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
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
      return c.json(err.toJSON(), err.statusCode as any);
    }
    throw err;
  }
});

// ── POST /api/admin/components/import ────────────────────────────────────────

adminComponentsRouter.post('/import', async (c) => {
  const admin = c.get('admin') as { id: number } | undefined;

  let body: unknown;
  try {
    const contentType = c.req.header('content-type') ?? '';

    if (contentType.includes('application/json')) {
      body = await c.req.json();
    } else {
      // For multipart/form-data, parse the file field
      const formData = await c.req.formData();
      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'file field is required' } }, 400);
      }
      const text = await (file as File).text();
      const fileType = (file as File).name?.endsWith('.json') ? 'json' : 'csv';

      if (fileType === 'json') {
        body = JSON.parse(text);
      } else {
        // Parse CSV: first line is headers, rest are data rows
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map((h) => h.trim());
        body = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim());
          return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
        });
      }
    }
  } catch {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Failed to parse import file' } }, 400);
  }

  if (!Array.isArray(body)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Import data must be an array' } }, 400);
  }

  const results = { total_rows: body.length, imported: 0, skipped: 0, failed: 0, errors: [] as unknown[] };

  for (let i = 0; i < body.length; i++) {
    const row = body[i] as Record<string, unknown>;
    try {
      await createComponent(row as unknown as ComponentInput);
      results.imported++;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('unique')) {
        results.skipped++;
      } else {
        results.failed++;
        results.errors.push({ row: i + 1, message: err instanceof Error ? err.message : 'Unknown error' });
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
