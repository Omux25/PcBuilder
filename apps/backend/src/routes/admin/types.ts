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

// Re-export parseId from utils/errors so admin routes only need one import.
export { parseId } from '../../utils/errors.js';
