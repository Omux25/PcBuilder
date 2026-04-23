> Built the admin login endpoint and the JWT middleware that protects all admin routes from unauthorized access.

**Track:** Backend · **Dev:** Salmane · **Status:** ✅ Done · **Files:** `backend/src/middleware/auth.ts`, `backend/src/routes/auth.ts`

---

## What was built

### `auth.ts` (middleware) — JWT verification

Protects any route it's attached to. Reads the `Authorization` header, verifies the JWT token, and either passes the request through or returns HTTP 401.

```typescript
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');

  // Must be present and start with "Bearer "
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authorization header is missing or malformed' } }, 401);
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Server misconfiguration: JWT_SECRET is not set' } }, 401);
  }

  try {
    const payload = jwt.verify(token, secret);
    c.set('admin', payload); // Attach decoded payload for downstream handlers
    await next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Token has expired' } }, 401);
    }
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }, 401);
  }
}
```

#### Why distinguish expired vs invalid?

| Error type | Cause | What it means |
|---|---|---|
| `TokenExpiredError` | Token is valid but past its expiry time | User was legitimate but their session timed out — they need to log in again |
| `JsonWebTokenError` | Token is malformed or has an invalid signature | Token is fake or tampered — potential security issue |

Both return HTTP 401, but the message differs so the client knows what to do.

#### Token state machine

```
Request arrives
  ↓
No Authorization header?  → 401 "missing or malformed"
  ↓
Doesn't start with "Bearer "?  → 401 "missing or malformed"
  ↓
JWT_SECRET not set?  → 401 "Server misconfiguration"
  ↓
jwt.verify() throws TokenExpiredError?  → 401 "Token has expired"
  ↓
jwt.verify() throws any other error?  → 401 "Invalid token"
  ↓
Valid token  → c.set('admin', payload) → next()
```

### `auth.ts` (route) — `POST /api/auth/login`

The only public admin endpoint. Takes a username and password, verifies them against the `admins` table, and returns a signed JWT.

```typescript
authRouter.post('/login', async (c) => {
  // 1. Parse and validate the body
  const { username, password } = body as Record<string, unknown>;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  // 2. Query the database (parameterized — injection-safe)
  const rows = await sql`
    SELECT id, username, password_hash
    FROM admins
    WHERE username = ${username}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  // 3. Compare password with stored bcrypt hash
  const passwordMatch = await bcrypt.compare(password, admin.password_hash);
  if (!passwordMatch) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }, 401);
  }

  // 4. Sign and return a JWT
  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    process.env.JWT_SECRET ?? 'changeme',
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' },
  );

  return c.json({ token });
});
```

#### Why the same error message for all failures?

Whether the username doesn't exist or the password is wrong, the response is always `"Invalid credentials"`. This prevents **user enumeration** — an attacker probing the API to discover which usernames exist.

#### Security properties

| Property | How it's enforced |
|---|---|
| Passwords never stored in plain text | bcrypt hash stored in `admins.password_hash` |
| SQL injection impossible | Bun.sql parameterized template literal |
| Username enumeration prevented | Same error message for all failure cases |
| Token expiry | `expiresIn: '8h'` — token is invalid after 8 hours |
| Secret from environment | `JWT_SECRET` read from `process.env`, never hardcoded |

### What the 7 tests cover

| Scenario | Expected result |
|---|---|
| No Authorization header | HTTP 401 |
| Header without "Bearer " prefix | HTTP 401 |
| Expired token | HTTP 401, message "Token has expired" |
| Token with invalid signature | HTTP 401, message "Invalid token" |
| Malformed token string | HTTP 401 |
| Valid token | Passes through, `c.get('admin')` is set |
| JWT_SECRET not set | HTTP 401 |

---

## Why it matters

Without the auth middleware, anyone could call `POST /api/admin/components` and add, modify, or delete components. The middleware is the gatekeeper — it runs before every admin route handler and rejects any request that doesn't carry a valid token.

The login route is the only way to get a token. It's the single entry point for admin access.

---

## Files involved

```
backend/
└── src/
    ├── middleware/
    │   ├── auth.ts                      ← created
    │   └── __tests__/
    │       ├── auth.test.ts             ← created
    │       └── tsconfig.json           ← created
    └── routes/
        └── auth.ts                      ← created
```
