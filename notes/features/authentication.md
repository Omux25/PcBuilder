# Authentication

The platform uses a two-token authentication system for admin access. Public routes (component list, prices, compatibility check) require no authentication. All admin routes require a valid JWT access token.

---

## How it works

### Login flow

```
POST /api/auth/login  { username, password }
  → rate limiter check (max 10 attempts/IP/minute)
  → query admins table by username
  → bcrypt.compare(password, stored_hash)
  → sign 15-minute JWT access token
  → generate 7-day refresh token (random 32-byte hex)
  → store refresh token hash in refresh_tokens table
  → return { access_token: "...", expires_in: 900 } in body
  → set HttpOnly cookie: refresh_token=<raw_token>
```

### Using the access token

Every protected request must include the access token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The `authMiddleware` in `apps/backend/src/middleware/auth.ts` verifies this token on every admin route. If the token is missing, expired, or invalid, it returns HTTP 401.

### Refreshing the access token

Access tokens expire after 15 minutes. The admin panel automatically refreshes them using the HttpOnly cookie:

```
POST /api/auth/refresh
  → reads refresh_token from HttpOnly cookie
  → looks up token hash in refresh_tokens table
  → checks expiry
  → returns new { access_token: "...", expires_in: 900 }
```

If the refresh token is expired or invalid, the user is redirected to the login page.

### Logout

```
POST /api/auth/logout
  → deletes refresh token from refresh_tokens table
  → clears the HttpOnly cookie
```

---

## JWT access token

A JWT (JSON Web Token) is a signed string with three parts: `header.payload.signature`.

The payload contains:
```json
{ "id": 1, "username": "admin", "iat": 1714300000, "exp": 1714300900 }
```

The server signs it with `JWT_SECRET` from the environment. Anyone can read the payload, but only the server can create a valid signature. If someone tampers with the payload, the signature check fails.

**Expiry:** 15 minutes. Short expiry limits the damage if a token is stolen — it becomes useless quickly.

### What the middleware checks

```
No Authorization header?          → 401 "Missing or malformed Authorization header"
Doesn't start with "Bearer "?     → 401 "Missing or malformed Authorization header"
JWT_SECRET not set?               → 401 "Server configuration error: JWT_SECRET is not set"
Token expired?                    → 401 "Token expired"
Invalid signature or malformed?   → 401 "Invalid token"
Valid token                       → attach admin payload to context, continue
```

The middleware distinguishes expired vs invalid tokens so the client knows whether to try refreshing or to redirect to login.

---

## Refresh token

The refresh token is a UUID stored as an HttpOnly cookie. HttpOnly means JavaScript cannot read it — only the browser sends it automatically on requests to the same origin. This protects against XSS attacks stealing the token.

The raw token is stored in the cookie. A hash of the token is stored in the `refresh_tokens` database table. If the database is compromised, the hashes cannot be reversed to get the raw tokens.

**Expiry:** 7 days. After 7 days, the user must log in again.

---

## Password storage

Admin passwords are stored as bcrypt hashes — never as plain text.

```
"mypassword" → "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHy"
```

bcrypt is a one-way function — you cannot reverse the hash to get the original password. When verifying, `bcrypt.compare(entered, stored_hash)` returns true or false without ever reversing the hash.

The cost factor (10) means each hash takes ~100ms to compute. This makes brute-force attacks impractical even if the database is stolen.

---

## Rate limiting

The login endpoint has an in-memory rate limiter: maximum 10 attempts per IP address per minute. After 10 failed attempts, the IP is blocked for 60 seconds and receives HTTP 429.

This prevents automated password-guessing attacks. bcrypt slows individual attempts, but without rate limiting an attacker could still try thousands of passwords per hour.

The rate limiter uses a `Map<string, { count, resetAt }>` keyed by IP address. It resets automatically after 60 seconds.

---

## Security properties

| Property | How it's enforced |
|---|---|
| Passwords never stored in plain text | bcrypt hash in `admins.password_hash` |
| SQL injection impossible | Bun.sql parameterized queries |
| Username enumeration prevented | Same error message for all login failures |
| XSS cannot steal refresh token | HttpOnly cookie |
| Short-lived access tokens | 15-minute JWT expiry |
| Brute force protection | 10 attempts/IP/minute rate limiter |
| Refresh token compromise limited | Hashed in DB, raw only in cookie |

---

## Admin panel token handling

The admin panel (`apps/admin/src/api.ts`) handles token lifecycle automatically:

1. On login: stores access token in memory (not localStorage — avoids XSS)
2. On every API call: attaches `Authorization: Bearer <token>` header
3. On 401 response: calls `POST /api/auth/refresh` to get a new token
4. If refresh succeeds: retries the original request with the new token
5. If refresh fails: redirects to `/admin/login`

This is transparent to the user — they stay logged in for 7 days without seeing any token expiry.
