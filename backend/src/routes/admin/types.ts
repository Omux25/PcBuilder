/**
 * Shared Hono environment type for all admin routes.
 *
 * Defines the context variables set by authMiddleware and validateComponent.
 * Import this in every admin route file instead of redefining it locally.
 */

export type AdminEnv = {
  Variables: {
    admin: { id: number; username?: string };
    validatedBody: unknown;
  };
};

/**
 * Parses and validates a route parameter as a positive integer.
 * Returns the parsed number, or null if invalid.
 *
 * Usage:
 *   const id = parseId(c.req.param('id'));
 *   if (id === null) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } }, 400);
 */
export function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
