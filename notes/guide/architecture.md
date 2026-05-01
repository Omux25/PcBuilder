# Architecture Guide

> **Full API reference:** See [`notes/reference/api.md`](../reference/api.md) for every endpoint with request/response shapes.

This guide explains the backend architecture — how the pieces fit together.

---

## Directory structure

```
backend/
├── src/
│   ├── app.ts              — Hono app: mounts all routers, global error handler
│   ├── server.ts           — Entry point: starts Bun.serve()
│   ├── routes/             — HTTP route handlers (thin — delegate to services)
│   │   ├── auth.ts
│   │   ├── components.ts
│   │   ├── compatibility.ts
│   │   ├── health.ts
│   │   ├── marketTrends.ts
│   │   ├── presets.ts
│   │   └── admin/          — Protected admin routes
│   ├── services/           — Business logic and data access
│   ├── middleware/         — auth.ts, validate.ts
│   ├── schemas/            — Zod validation schemas
│   ├── utils/              — Pure utilities (errors, slugify, matcher, etc.)
│   └── db/
│       ├── index.ts        — Centralized getSql() with DI support
│       ├── migrate.ts      — Migration runner
│       └── migrations/     — SQL migration files (001–019)
└── scraper/
    ├── session.ts          — Core scraping logic
    ├── scheduler.ts        — Bun.cron() job
    ├── aggregator.ts       — Processes scraped prices → DB
    ├── autoMapper.ts       — DNA matcher → scraper_mappings
    ├── catalogBuilder.ts   — Auto-creates catalog entries
    ├── scrapers/           — Site-specific scrapers
    └── utils/logger.ts     — Structured logger → scraper_logs table
```

---

## API routes table

### Public routes (no auth)

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/health` | `health.ts` | Health check |
| GET | `/api/components` | `components.ts` | Paginated component list |
| GET | `/api/components/slug/:slug` | `components.ts` | Component by slug |
| GET | `/api/components/:id` | `components.ts` | Component by ID |
| GET | `/api/components/:id/prices` | `components.ts` | Price offers |
| GET | `/api/components/:id/price-history` | `components.ts` | Price history |
| POST | `/api/components/smart-search` | `components.ts` | Search with compatibility + prices |
| POST | `/api/compatibility/validate` | `compatibility.ts` | Validate a build |
| GET | `/api/builds/presets` | `presets.ts` | List preset builds |
| GET | `/api/builds/presets/:id` | `presets.ts` | Single preset |
| GET | `/api/market-trends` | `marketTrends.ts` | Price drops/hikes |
| POST | `/api/auth/login` | `auth.ts` | Admin login |
| POST | `/api/auth/refresh` | `auth.ts` | Refresh access token |
| POST | `/api/auth/logout` | `auth.ts` | Logout |

### Protected routes (JWT required)

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/admin/dashboard` | `admin/dashboard.ts` | Stats + chart + activity |
| GET/POST/PUT/DELETE | `/api/admin/components` | `admin/components.ts` | Component CRUD |
| POST | `/api/admin/components/:id/deactivate` | `admin/components.ts` | Soft-delete (hide from public) |
| POST | `/api/admin/components/import` | `admin/components.ts` | Bulk import |
| GET/POST/PUT/DELETE | `/api/admin/retailers` | `admin/retailers.ts` | Retailer CRUD |
| GET/POST/PUT/DELETE | `/api/admin/presets` | `admin/presets.ts` | Preset CRUD |
| POST | `/api/admin/scrapers/run-all` | `admin/scrapers.ts` | Trigger all scrapers |
| POST | `/api/admin/scrapers/:id/run` | `admin/scrapers.ts` | Trigger one scraper |
| GET | `/api/admin/unmatched-listings` | `admin/unmatched.ts` | Unmatched products |
| POST | `/api/admin/unmatched-listings/:id/link` | `admin/unmatched.ts` | Link to component |
| POST | `/api/admin/unmatched-listings/:id/dismiss` | `admin/unmatched.ts` | Dismiss listing |
| GET | `/api/admin/logs` | `admin/logs.ts` | Scraper logs |

---

## Request lifecycle

```
HTTP request
  → Hono router matches path
  → Global middleware (secureHeaders, logger, CORS)
  → Route-specific middleware (authMiddleware, validateComponent)
  → Route handler
      → calls service function(s)
          → getSql() → Bun.sql query
          → returns typed result
      → returns JSON response
  → Global error handler (catches AppError and unhandled exceptions)
```

---

## Dependency injection pattern

All database access goes through `getSql()` from `backend/src/db/index.ts`. This allows tests to inject a mock SQL function:

```typescript
import { setSql, resetSql } from '../db/index.js';

beforeEach(() => setSql(mockSql));
afterAll(() => resetSql());
```

Never import `sql` directly from `bun` in route handlers or services — always use `getSql()`.

---

## Error handling

All errors use `AppError` from `backend/src/utils/errors.ts`:

```typescript
throw new AppError('COMPONENT_NOT_FOUND', 'Component with id 42 not found', 404);
```

The global error handler in `app.ts` catches these and returns the standard error shape:
```json
{ "error": { "code": "COMPONENT_NOT_FOUND", "message": "Component with id 42 not found" } }
```
