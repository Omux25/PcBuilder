/**
 * Authentication routes
 *
 * POST /api/auth/login   — validate credentials, return access token + set refresh cookie
 * POST /api/auth/refresh — exchange refresh token cookie for new access token
 * POST /api/auth/logout  — invalidate refresh token and clear cookie
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

import { Hono } from 'hono';
import { sql } from 'bun';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const authRouter = new Hono();

// ── Constants ────────────────────────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRY  = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const COOKIE_NAME = 'refresh_token';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSecret(): string {
  return process.env.JWT_SECRET ?? 'changeme';
}

function makeAccessToken(adminId: number, username: string): string {
  return jwt.sign({ id: adminId, username }, getSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function refreshTokenExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return d;
}

function setRefreshCookie(c: any, token: string): void {
  const expires = refreshTokenExpiry();
  c.header(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Strict; Expires=${expires.toUTCString()}`,
  );
}

function clearRefreshCookie(c: any): void {
  c.header(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`,
  );
}

function getRefreshTokenFromCookie(c: any): string | null {
  const cookieHeader = c.req.header('cookie') ?? '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────

authRouter.post('/login', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  if (!body || typeof body !== 'object') {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  const { username, password } = body as Record<string, unknown>;

  if (typeof username !== 'string' || typeof password !== 'string') {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  let rows: Array<{ id: number; username: string; password_hash: string }>;
  try {
    rows = await sql`
      SELECT id, username, password_hash FROM admins
      WHERE username = ${username}
      LIMIT 1
    `;
  } catch {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  if (rows.length === 0) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  const admin = rows[0];
  const passwordMatch = await bcrypt.compare(password, admin.password_hash);

  if (!passwordMatch) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  // Generate tokens
  const accessToken  = makeAccessToken(admin.id, admin.username);
  const refreshToken = randomUUID();
  const expiresAt    = refreshTokenExpiry();

  // Store refresh token in DB
  await sql`
    INSERT INTO refresh_tokens (admin_id, token, expires_at)
    VALUES (${admin.id}, ${refreshToken}, ${expiresAt.toISOString()})
  `;

  setRefreshCookie(c, refreshToken);

  return c.json({
    access_token: accessToken,
    expires_in: 900, // 15 minutes in seconds
  });
});

// ── POST /api/auth/refresh ───────────────────────────────────────────────────

authRouter.post('/refresh', async (c) => {
  const refreshToken = getRefreshTokenFromCookie(c);

  if (!refreshToken) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'No refresh token' } }, 401);
  }

  // Look up the token in DB
  const rows = await sql`
    SELECT rt.admin_id, rt.expires_at, a.username
    FROM refresh_tokens rt
    JOIN admins a ON a.id = rt.admin_id
    WHERE rt.token = ${refreshToken}
    LIMIT 1
  ` as { admin_id: number; expires_at: string; username: string }[];

  if (rows.length === 0) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } }, 401);
  }

  const { admin_id, expires_at, username } = rows[0];

  if (new Date(expires_at) < new Date()) {
    // Clean up expired token
    await sql`DELETE FROM refresh_tokens WHERE token = ${refreshToken}`;
    clearRefreshCookie(c);
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Refresh token expired' } }, 401);
  }

  const accessToken = makeAccessToken(admin_id, username);

  return c.json({
    access_token: accessToken,
    expires_in: 900,
  });
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────

authRouter.post('/logout', async (c) => {
  const refreshToken = getRefreshTokenFromCookie(c);

  if (refreshToken) {
    await sql`DELETE FROM refresh_tokens WHERE token = ${refreshToken}`;
  }

  clearRefreshCookie(c);
  return c.json({ success: true });
});

export { authRouter };
