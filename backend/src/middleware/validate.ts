/**
 * Zod validation middleware for Hono.
 *
 * Reads the `category` field from the request body, selects the matching
 * Zod schema, and validates the entire body against it.
 *
 * On failure → HTTP 400 with field-level error details.
 * On success → calls next() and the validated data is available via c.get('validatedBody').
 *
 * Requirements: 8.2, 8.3, 11.2
 */

import type { Context, Next } from 'hono';
import { componentSchemas, type ComponentCategory } from '../schemas/componentSchemas.js';

/**
 * Middleware factory — validates the request body against the Zod schema
 * that corresponds to the `category` field in the body.
 *
 * Usage:
 *   app.post('/api/admin/components', validateComponent, handler)
 */
export async function validateComponent(c: Context, next: Next): Promise<Response | void> {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body must be valid JSON',
          fields: [],
        },
      },
      400,
    );
  }

  // Determine category
  const category =
    body !== null && typeof body === 'object' && 'category' in body
      ? (body as Record<string, unknown>).category
      : undefined;

  if (typeof category !== 'string' || !(category in componentSchemas)) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: `Field 'category' is required and must be one of: ${Object.keys(componentSchemas).join(', ')}`,
          fields: ['category'],
        },
      },
      400,
    );
  }

  const schema = componentSchemas[category as ComponentCategory];
  const result = schema.safeParse(body);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.') || issue.message);

    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fields,
        },
      },
      400,
    );
  }

  // Attach validated data for downstream handlers
  c.set('validatedBody', result.data);

  await next();
}
