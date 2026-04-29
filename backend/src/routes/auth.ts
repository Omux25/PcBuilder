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
import { getSql } from '../db/index.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';

const authRouter = new Hono();

// ── Rate limiter ─────────────────────────────────────────────────────────────
// Simple in-memory rate limiter: max 10 login attempts per IP per minute.

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_MAP_SIZE = 10_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    // Clean up stale entries periodically to prevent unbounded growth
    if (loginAttempts.size > MAX_MAP_SIZE) {
      for (const [key, val] of loginAttempts) {
        if (now > val.resetAt) loginAttempts.delete(key);
      }
    }
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }

  entry.count++;
  if (entry.count > 10) return true;
  return false;
}

// Clean up stale rate-limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of loginAttempts) {
    if (now > val.resetAt) loginAttempts.delete(key);
  }
}, 5 * 60_000).unref?.();

// ── Refresh token helpers ────────────────────────────────────────────────────

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

const ACCESS_TOKEN_EXPIRY  = '15m';
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
  const sql = getSql();
  const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';

  if (isRateLimited(ip)) {
    return c.json(
      { error: { code: 'RATE_LIMITED', message: 'Trop de tentatives de connexion. Réessayez dans une minute.' } },
      429,
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Identifiants invalides' } }, 401);
  }

  if (!body || typeof body !== 'object') {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Identifiants invalides' } }, 401);
  }

  const { username, password } = body as Record<string, unknown>;

  if (typeof username !== 'string' || typeof password !== 'string') {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Identifiants invalides' } }, 401);
  }

  let rows: Array<{ id: number; username: string; password_hash: string }>;
  try {
    rows = (await sql`
      SELECT id, username, password_hash FROM admins
      WHERE username = ${username}
      LIMIT 1
    `) as { id: number; username: string; password_hash: string }[];
  } catch {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Identifiants invalides' } }, 401);
  }

  if (rows.length === 0) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Identifiants invalides' } }, 401);
  }

  const admin = rows[0];
  const passwordMatch = await bcrypt.compare(password, admin.password_hash);

  if (!passwordMatch) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Identifiants invalides' } }, 401);
  }

  // Generate tokens
  const accessToken  = makeAccessToken(admin.id, admin.username);
  const rawRefresh   = generateRefreshToken();
  const refreshHash  = hashRefreshToken(rawRefresh);
  const expiresAt    = refreshTokenExpiry();

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
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Jeton de rafraîchissement manquant' } }, 401);
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
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Jeton de rafraîchissement invalide' } }, 401);
  }

  const matched = rows[0];
  const accessToken = makeAccessToken(matched.admin_id, matched.username);

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
