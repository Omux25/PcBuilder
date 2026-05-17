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
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSql } from '../../core/db/index.js';
import { isRateLimited } from '../../core/utils/rateLimiter.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';

const authRouter = new Hono();

/**
 * Generates a cryptographically strong 32-byte random token (256 bits).
 * Returns the raw hex string — this is what goes in the cookie.
 */
function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Creates a SHA-256 hash of a refresh token for database storage.
 * SHA-256 is used instead of bcrypt because refresh tokens are already
 * high-entropy random values (not user-chosen passwords), so a fast
 * hash is sufficient. This allows O(1) lookup by hash instead of
 * the O(N) bcrypt comparison loop that was used before.
 */
function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const COOKIE_NAME = 'refresh_token';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set and at least 32 characters long. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }
  return secret;
}

function makeAccessToken(adminId: number, username: string): string {
  return jwt.sign({ id: adminId, username }, getSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY as any });
}

function refreshTokenExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return d;
}

function setRefreshCookie(c: Context, token: string): void {
  const expires = refreshTokenExpiry();
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  c.header(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Strict; Expires=${expires.toUTCString()}${secure}`,
  );
}

function clearRefreshCookie(c: Context): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  c.header(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure}`,
  );
}

function getRefreshTokenFromCookie(c: Context): string | null {
  return getCookie(c, COOKIE_NAME) ?? null;
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────

authRouter.post('/login', async (c) => {
  const sql = getSql();
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';

  if (await isRateLimited(`rate_limit:login:${ip}`, 10, 60)) {
    return c.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again in a minute.' } },
      429,
    );
  }

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

  // Reject oversized inputs before hitting the database.
  // Legitimate usernames/passwords are never this long.
  if (username.length > 128 || password.length > 256) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  let rows: Array<{ id: number; username: string; password_hash: string }>;
  try {
    rows = (await sql`
      SELECT id, username, password_hash FROM admins
      WHERE username = ${username}
      LIMIT 1
    `) as { id: number; username: string; password_hash: string }[];
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
  const accessToken = makeAccessToken(admin.id, admin.username);
  const rawRefresh = generateRefreshToken();
  const refreshHash = hashRefreshToken(rawRefresh);
  const expiresAt = refreshTokenExpiry();

  // Store SHA-256 hash in DB — never the raw token
  await sql`
    INSERT INTO refresh_tokens (admin_id, token, expires_at)
    VALUES (${admin.id}, ${refreshHash}, ${expiresAt.toISOString()})
  `;

  setRefreshCookie(c, rawRefresh);

  return c.json({
    access_token: accessToken,
    expires_in: 900, // 15 minutes in seconds
  });
});

// ── POST /api/auth/refresh ───────────────────────────────────────────────────

authRouter.post('/refresh', async (c) => {
  const sql = getSql();
  const rawToken = getRefreshTokenFromCookie(c);

  if (!rawToken) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Refresh token missing' } }, 401);
  }

  // SHA-256 lookup — O(1) instead of O(N) bcrypt scan
  const tokenHash = hashRefreshToken(rawToken);

  const rows = await sql`
    SELECT rt.id, rt.admin_id, a.username
    FROM refresh_tokens rt
    JOIN admins a ON a.id = rt.admin_id
    WHERE rt.token = ${tokenHash}
      AND rt.expires_at > NOW()
    LIMIT 1
  ` as { id: number; admin_id: number; username: string }[];

  if (rows.length === 0) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } }, 401);
  }

  const matched = rows[0];
  const accessToken = makeAccessToken(matched.admin_id, matched.username);

  // Rotate refresh token atomically: delete old and insert new in a single transaction.
  // Without a transaction, a server crash between the DELETE and INSERT would leave
  // the user with no valid refresh token, forcing them to log in again.
  const newRawRefresh = generateRefreshToken();
  const newRefreshHash = hashRefreshToken(newRawRefresh);
  const newExpiresAt = refreshTokenExpiry();

  await sql.begin(async (tx) => {
    await tx`DELETE FROM refresh_tokens WHERE id = ${matched.id}`;
    await tx`
      INSERT INTO refresh_tokens (admin_id, token, expires_at)
      VALUES (${matched.admin_id}, ${newRefreshHash}, ${newExpiresAt.toISOString()})
    `;
  });

  setRefreshCookie(c, newRawRefresh);

  return c.json({
    access_token: accessToken,
    expires_in: 900,
  });
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────

authRouter.post('/logout', async (c) => {
  const sql = getSql();
  const rawToken = getRefreshTokenFromCookie(c);

  if (rawToken) {
    // SHA-256 lookup — O(1) deletion
    const tokenHash = hashRefreshToken(rawToken);
    await sql`DELETE FROM refresh_tokens WHERE token = ${tokenHash}`;
  }

  clearRefreshCookie(c);
  return c.json({ success: true });
});

export { authRouter };

// ── Expired token cleanup ─────────────────────────────────────────────────────
// Call startRefreshTokenCleanup() from server.ts to begin the cleanup interval.
// Keeping this out of module-level side effects prevents the timer from firing
// when auth.ts is imported in tests.

let _cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startRefreshTokenCleanup(): void {
  if (_cleanupInterval) return; // already running
  _cleanupInterval = setInterval(async () => {
    try {
      const sql = getSql();
      await sql`DELETE FROM refresh_tokens WHERE expires_at < NOW()`;
    } catch (err) {
      // Log errors even though cleanup is non-critical — DB issues should be visible
      console.error('[auth] Refresh token cleanup failed:', err instanceof Error ? err.message : String(err));
    }
  }, 6 * 60 * 60 * 1000); // every 6 hours
  _cleanupInterval.unref?.();
}

export function stopRefreshTokenCleanup(): void {
  if (_cleanupInterval) {
    clearInterval(_cleanupInterval);
    _cleanupInterval = null;
  }
}
