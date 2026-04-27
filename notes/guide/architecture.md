# Architecture

How the project is structured and how the layers connect.

## Project structure

```
PcBuilder/
├── backend/                    ← Bun + Hono server (runs in WSL2)
│   ├── src/
│   │   ├── db/
│   │   │   └── migrations/     ← SQL scripts that create database tables
│   │   ├── routes/             ← HTTP endpoints (the API surface)
│   │   │   ├── auth.ts         ← POST /api/auth/login ✅
│   │   │   ├── components.ts   ← GET /api/components (in progress)
│   │   │   ├── prices.ts       ← GET /api/components/:id/prices (planned)
│   │   │   ├── compatibility.ts← POST /api/compatibility/validate (planned)
│   │   │   └── admin/          ← JWT-protected admin routes (planned)
│   │   ├── middleware/         ← Functions that run before route handlers
│   │   │   ├── auth.ts         ← JWT verification ✅
│   │   │   └── validate.ts     ← Zod request validation ✅
│   │   ├── services/           ← Business logic and database queries
│   │   │   ├── compatibilityService.ts ← 6 compatibility rules ✅
│   │   │   └── componentService.ts     ← DB queries for components ✅
│   │   ├── schemas/            ← Zod schemas per component category
│   │   │   └── componentSchemas.ts ✅
│   │   ├── app.ts              ← Hono app wiring ✅
│   │   └── server.ts           ← Entry point — Bun.serve() ✅
│   ├── scraper/                ← Price scraping system (planned)
│   │   ├── scrapers/           ← One scraper per retailer site
│   │   ├── aggregator.ts       ← UPSERT prices into database
│   │   └── scheduler.ts        ← Bun.cron() — runs every 24h
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   ← React + Vite (planned)
├── notes/                      ← Team documentation (committed to Git)
└── docs/                       ← Generated artifacts (gitignored)
```

## The three layers

### 1. Routes (HTTP layer)

Routes receive HTTP requests and send responses. They don't contain business logic — they delegate to services.

```
Request → Middleware → Route handler → Service → Response
```

Example flow for `POST /api/compatibility/validate`:
1. Request arrives at Hono
2. Zod middleware validates the body shape
3. Route handler calls `validateCompatibility(build)`
4. Result is returned as JSON

### 2. Services (business logic layer)

Services contain the rules of the application. They don't know about HTTP — they take data in and return a result.

- `compatibilityService.ts` — the 6 compatibility rules
- `componentService.ts` — all database queries for components and prices

Routes call services. Services never call routes.

### 3. Database (data layer)

PostgreSQL stores all persistent data. Only services talk to the database directly — routes never write SQL.

`Bun.sql` is used as a tagged template literal. All values are automatically parameterized.

## Middleware chain

For a protected admin route, the request passes through three layers before reaching the handler:

```
POST /api/admin/components
  → authMiddleware      checks JWT token → 401 if invalid
  → validateComponent   checks body with Zod → 400 if invalid
  → route handler       inserts into database → 201 on success
```

If any middleware returns a response, the chain stops — the handler never runs.

## The scraping system

The scraper runs independently of the API, triggered by `Bun.cron()` every 24 hours:

```
Bun.cron() → Scheduler
  → Site1Scraper (undici + cheerio) → ScrapedPrice[]
  → Site2Scraper (undici + cheerio) → ScrapedPrice[]
  → Aggregator → UPSERT into prices table
  → Logger → INSERT into scraper_logs table
```

Each scraper runs inside a `try/catch`. If one fails, the error is logged and the next scraper continues — one broken site doesn't stop the whole session.

## API routes reference

### Public (no auth required)

| Method | Route | What it does |
|---|---|---|
| GET | `/api/components` | List components, optional `?category=`, `?socket=`, `?ram_type=` filters |
| GET | `/api/components/:id` | Single component by ID |
| GET | `/api/components/:id/prices` | Price offers for a component, sorted cheapest first |
| POST | `/api/compatibility/validate` | Validate a build, returns errors and warnings |
| POST | `/api/auth/login` | Admin login, returns JWT |

### Protected (JWT required)

| Method | Route | What it does |
|---|---|---|
| POST | `/api/admin/components` | Create a component |
| PUT | `/api/admin/components/:id` | Update a component |
| DELETE | `/api/admin/components/:id` | Delete a component |
| GET | `/api/admin/logs` | Query scraper logs — optional `?level=`, `?site=`, `?limit=` filters |

## Error response format

All errors follow this exact shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "fields": ["field1", "field2"]
  }
}
```

`fields` is only present for validation errors (HTTP 400). It lists the exact field names that failed.

## Diagram

See [../diagrams/architecture.puml](../diagrams/architecture.puml) for the full system architecture diagram, and [../diagrams/api_routes.puml](../diagrams/api_routes.puml) for the API routes diagram.
