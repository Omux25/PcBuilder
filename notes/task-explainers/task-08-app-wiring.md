# Task 8 — App Wiring (`app.ts` + `server.ts`)

## What was built

Two files that connect all the pieces of the backend into a running server.

---

## Files created

- `backend/src/app.ts` — Hono app: mounts all routers, global 404, global error handler
- `backend/src/server.ts` — entry point: starts `Bun.serve()` on the configured port

---

## `app.ts` — what it does

This file creates the Hono app and mounts every router under its correct prefix:

```
/api/auth              → authRouter          (POST /login)
/api/components        → componentsRouter    (GET /, GET /:id)
/api/components        → pricesRouter        (GET /:id/prices)
/api/compatibility     → compatibilityRouter (POST /validate)
/api/admin/components  → adminComponentsRouter (POST, PUT, DELETE)
/api/admin/logs        → adminLogsRouter     (GET /)
```

It also registers two global handlers:

**`app.notFound`** — returns a 404 with the standard error shape for any route that doesn't match:
```json
{ "error": { "code": "NOT_FOUND", "message": "Route GET /api/unknown not found" } }
```

**`app.onError`** — catches any unhandled exception thrown inside a route handler. Logs it to the console and returns a generic 500 so internal stack traces are never exposed to clients:
```json
{ "error": { "code": "INTERNAL_ERROR", "message": "An unexpected error occurred" } }
```

### Why two routers on `/api/components`?

`componentsRouter` handles `GET /api/components` and `GET /api/components/:id`.
`pricesRouter` handles `GET /api/components/:id/prices`.

They're separate files because they have different concerns (component data vs. price data). Hono merges them cleanly when both are mounted on the same prefix — the `:id/prices` pattern in `pricesRouter` doesn't conflict with the `:id` pattern in `componentsRouter`.

---

## `server.ts` — what it does

Minimal entry point. Reads `PORT` from the environment (defaults to 3000) and starts `Bun.serve()`:

```typescript
const server = Bun.serve({
  port,
  fetch: app.fetch,
});
```

`app.fetch` is Hono's standard Web API handler — it takes a `Request` and returns a `Response`. `Bun.serve()` calls it for every incoming request.

### How to run

```bash
# Development (hot reload on file changes)
bun --hot src/server.ts

# Production
bun src/server.ts
```

Or via the npm scripts in `package.json`:
```bash
bun run dev    # hot reload
bun run start  # production
```

---

## Why `app.ts` is separate from `server.ts`

Keeping the Hono app in its own file makes it importable in tests without starting a real server. Integration tests can do:

```typescript
import { app } from '../app.js';
const res = await app.request('/api/components');
```

No port binding, no network — just the app logic.

---

## What's next

Phase 5 — Scraping system:
- Task 10.1: Structured logger that writes to the `scraper_logs` table
- Task 10.2: Abstract base scraper (undici + cheerio)
- Task 10.3: Site-specific scrapers
- Task 10.4: Aggregator (UPSERT prices)
- Task 10.5: Scheduler (`Bun.cron()` every 24h)
