# Task 7.3 — Admin Logs Route (`GET /api/admin/logs`)

## What was built

A JWT-protected route that lets admins query the `scraper_logs` table with optional filters.

**Endpoint:** `GET /api/admin/logs`

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `level` | `INFO` \| `WARNING` \| `ERROR` | — | Filter by log level |
| `site` | string | — | Filter by site name |
| `limit` | integer (1–500) | 100 | Max rows to return |

**Response:**
```json
{
  "logs": [
    {
      "id": 3,
      "level": "ERROR",
      "site": "site1.ma",
      "message": "Failed to fetch product page",
      "created_at": "2024-06-03T10:00:00Z"
    }
  ],
  "count": 1
}
```

Logs are always returned newest-first (`ORDER BY created_at DESC`).

---

## Files created

- `backend/src/routes/admin/logs.ts` — the route handler
- `backend/src/routes/admin/__tests__/logs.test.ts` — 8 unit tests

---

## How it works

### Auth

The route uses `adminLogsRouter.use('/*', authMiddleware)` — every request must carry a valid `Authorization: Bearer <token>` header. Returns 401 otherwise.

### Validation

Before hitting the database, the route validates query params:

- `level` must be one of `INFO`, `WARNING`, `ERROR` — returns 400 if not
- `limit` must be a positive integer — returns 400 if not; capped at 500 silently

### Query building

The route uses Bun.sql tagged templates directly (no service layer needed — logs are read-only and have no business logic). Four query branches cover all filter combinations:

```
level + site  → WHERE level = $1 AND site = $2
level only    → WHERE level = $1
site only     → WHERE site = $1
no filters    → (all rows)
```

All queries use `ORDER BY created_at DESC LIMIT $n` — newest logs first, bounded result set.

### Why no service layer?

The component routes use a `componentService.ts` because the same DB queries are reused across multiple routes and need to be mockable in tests. The logs route is a single read-only endpoint with no reuse — adding a service layer would be unnecessary indirection.

---

## Testing approach

The tests cover:
- Auth guard (401 without token, 401 with invalid token)
- Validation (invalid level, zero/negative/non-numeric limit)
- Response shape (error format matches the project standard)

The "accepts valid level values" test intentionally reaches the DB (which isn't running in test env) to confirm the validation layer passes — the test asserts `status !== 400`, not `status === 200`.

---

## What's next

Task 8 — App wiring: create `app.ts` (mount all routers) and `server.ts` (Bun.serve entry point).
