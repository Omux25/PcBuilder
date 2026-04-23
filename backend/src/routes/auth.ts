/**
 * Authentication route — POST /api/auth/login
 *
 * Validates admin credentials against the `admins` table using Bun.sql,
 * compares the password with the stored bcrypt hash, and returns a signed JWT
 * on success.
 *
 * Requirements: 11.3, 11.4
 */

import { Hono } from 'hono';
import { sql } from 'bun';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const authRouter = new Hono();

authRouter.post('/login', async (c) => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        },
      },
      401,
    );
  }

  if (body === null || typeof body !== 'object') {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        },
      },
      401,
    );
  }

  const { username, password } = body as Record<string, unknown>;

  if (typeof username !== 'string' || typeof password !== 'string') {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        },
      },
      401,
    );
  }

  // Query the admins table using Bun.sql (parameterized — injection-safe)
  let rows: Array<{ id: number; username: string; password_hash: string }>;
  try {
    rows = await sql`
      SELECT id, username, password_hash
      FROM admins
      WHERE username = ${username}
      LIMIT 1
    `;
  } catch {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        },
      },
      401,
    );
  }

  if (rows.length === 0) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        },
      },
      401,
    );
  }

  const admin = rows[0];
  const passwordMatch = await bcrypt.compare(password, admin.password_hash);

  if (!passwordMatch) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        },
      },
      401,
    );
  }

  const secret = process.env.JWT_SECRET ?? 'changeme';
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '8h') as jwt.SignOptions['expiresIn'];

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    secret,
    { expiresIn },
  );

  return c.json({ token });
});

export { authRouter };
