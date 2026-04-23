/**
 * JWT authentication middleware for Hono.
 *
 * Verifies the `Authorization: Bearer <token>` header using `jsonwebtoken`.
 * - Returns HTTP 401 if the token is absent, malformed, or expired.
 * - On success, attaches the decoded payload to context via `c.set('admin', payload)`.
 *
 * Requirements: 11.3, 11.4
 */

import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';

/**
 * Middleware that enforces JWT authentication on protected routes.
 *
 * Usage:
 *   app.post('/api/admin/components', authMiddleware, handler)
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header is missing or malformed',
        },
      },
      401,
    );
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Server misconfiguration: JWT_SECRET is not set',
        },
      },
      401,
    );
  }

  try {
    const payload = jwt.verify(token, secret);
    c.set('admin', payload);
    await next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return c.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Token has expired',
          },
        },
        401,
      );
    }

    // Covers JsonWebTokenError (malformed, invalid signature, etc.)
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
        },
      },
      401,
    );
  }
}
