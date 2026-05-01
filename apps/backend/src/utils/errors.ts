import type { ContentfulStatusCode as StatusCode } from 'hono/utils/http-status';

/**
 * Application-level error class.
 *
 * Use this instead of attaching `.code` to plain Error objects via
 * the NodeJS.ErrnoException hack. Provides a structured error with
 * an HTTP status code, an error code string, and a message.
 *
 * Example:
 *   throw new AppError('COMPONENT_NOT_FOUND', 'Component with id 42 not found', 404);
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: StatusCode;

  constructor(code: string, message: string, statusCode: StatusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }

  /** Returns a JSON-safe error payload for API responses. */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}

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
