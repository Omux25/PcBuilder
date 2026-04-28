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
import { randomBytes } from 'crypto';

const authRouter = new Hono();

// ── Rate limiter ─────────────────────────────────────────────────────────────
// Simple in-memory rate limiter: max 10 login attempts per IP per minute.

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }

  entry.count++;
  if (entry.count > 10) return true;
  return false;
}

// ── Refresh token helpers ────────────────────────────────────────────────────

/**
 * Generates a cryptographically strong 32-byte random token (256 bits).
 * Returns the raw hex string — this is what goes in the cookie.
 */
function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hashes a raw refresh token with bcrypt before storing in the DB.
 * Cost factor 10 — fast enough for login, strong enough for storage.
 * If the DB is compromised, raw tokens cannot be recovered from hashes.
 */
async function hashRefreshToken(raw: string): Promise<string> {
  return bcrypt.hash(raw, 10);
}

/**
 * Verifies a raw refresh token against a stored bcrypt hash.
 */
async function verifyRefreshToken(raw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(raw, hash);
}

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
    rows = await sql`
      SELECT id, username, password_hash FROM admins
      WHERE username = ${username}
      LIMIT 1
    `;
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
  const refreshHash  = await hashRefreshToken(rawRefresh);
  const expiresAt    = refreshTokenExpiry();

  // Store refresh token HASH in DB — never the raw token
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
  const rawToken = getRefreshTokenFromCookie(c);

  if (!rawToken) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Jeton de rafraîchissement manquant' } }, 401);
  }

  // Fetch all non-expired tokens — we must compare hashes since we can't
  // query by raw value. Limit to recent tokens to keep this fast.
  const rows = await sql`
    SELECT rt.id, rt.admin_id, rt.token AS token_hash, rt.expires_at, a.username
    FROM refresh_tokens rt
    JOIN admins a ON a.id = rt.admin_id
    WHERE rt.expires_at > NOW()
    ORDER BY rt.expires_at DESC
    LIMIT 50
  ` as { id: number; admin_id: number; token_hash: string; expires_at: string; username: string }[];

  // Find the matching token by comparing raw value against stored hashes
  let matched: typeof rows[0] | null = null;
  for (const row of rows) {
    if (await verifyRefreshToken(rawToken, row.token_hash)) {
      matched = row;
      break;
    }
  }

  if (!matched) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Jeton de rafraîchissement invalide' } }, 401);
  }

  const accessToken = makeAccessToken(matched.admin_id, matched.username);

  return c.json({
    access_token: accessToken,
    expires_in: 900,
  });
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────

authRouter.post('/logout', async (c) => {
  const rawToken = getRefreshTokenFromCookie(c);

  if (rawToken) {
    // Find and delete the matching hashed token
    const rows = await sql`
      SELECT id, token AS token_hash FROM refresh_tokens
      WHERE expires_at > NOW()
      ORDER BY expires_at DESC
      LIMIT 50
    ` as { id: number; token_hash: string }[];

    for (const row of rows) {
      if (await verifyRefreshToken(rawToken, row.token_hash)) {
        await sql`DELETE FROM refresh_tokens WHERE id = ${row.id}`;
        break;
      }
    }
  }

  clearRefreshCookie(c);
  return c.json({ success: true });
});

export { authRouter };
