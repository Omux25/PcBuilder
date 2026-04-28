# PC Builder — Backend

Bun + Hono REST API server with a PostgreSQL database and a built-in price scraping system.

Runs inside WSL2. All commands below assume you're in the `backend/` directory inside WSL2.

---

## Structure

```
backend/
├── src/
│   ├── app.ts              ← Hono app — mounts all routes, CORS, error handlers
│   ├── server.ts           ← Entry point — Bun.serve() on PORT
│   ├── db/
│   │   └── migrations/     ← 14 SQL migration files (001–014)
│   ├── routes/             ← HTTP route handlers
│   │   ├── auth.ts         ← POST /api/auth/login, /refresh, /logout
│   │   ├── components.ts   ← GET /api/components, /slug/:slug, /:id, /:id/price-history
│   │   ├── prices.ts       ← GET /api/components/:id/prices
│   │   ├── compatibility.ts← POST /api/compatibility/validate
│   │   ├── smartSearch.ts  ← GET /api/components/smart-search
│   │   ├── health.ts       ← GET /api/health
│   │   └── admin/          ← JWT-protected admin routes
│   ├── middleware/
│   │   ├── auth.ts         ← JWT verification middleware
│   │   └── validate.ts     ← Zod request body validation
│   ├── services/           ← Business logic and database queries
│   ├── schemas/
│   │   └── componentSchemas.ts  ← Zod schemas for all 8 component categories
│   └── utils/
│       ├── slugify.ts           ← Slug generation helpers
│       ├── componentMatcher.ts  ← DNA-based product name matching
│       └── variantExtractor.ts  ← Extract variant labels from scraped names
├── scraper/                ← Price scraping system (see scraper/README.md)
├── scripts/                ← One-off and operational scripts (see scripts/README.md)
├── tests/
│   └── fixtures/
│       └── golden_dataset.json  ← 50-entry ground truth for matcher evaluation
└── package.json
```

---

## Running

```bash
# Development (hot reload)
bun --hot src/server.ts

# Production
bun src/server.ts
```

Or from PowerShell via WSL2:
```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun --hot src/server.ts"
```

---

## Testing

```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun test 2>&1"
```

324 tests across 26 files. Includes unit tests, integration tests, and property-based tests (fast-check).

---

## Key concepts

- **Routes** delegate to **services** — no SQL in route handlers
- **Services** use `Bun.sql` tagged template literals — all queries are parameterized
- **Dependency injection** — services export `setSql(mock)` / `resetSql()` so tests run without a real database
- All source files use TypeScript with ESM imports (`.js` extension in import paths)

For full documentation see [../notes/reference/](../notes/reference/) and [../notes/features/](../notes/features/).
