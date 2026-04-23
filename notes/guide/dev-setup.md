# Dev Setup

How to run the server, tests, and migrations locally.

## Prerequisites

- Windows with WSL2 installed (Ubuntu distro)
- Bun installed in WSL2 at `~/.bun/bin/bun`
- PostgreSQL running in WSL2
- VS Code with the WSL extension

## Running tests

All tests run inside WSL2. From PowerShell:

```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun test 2>&1"
```

From inside WSL2 directly:

```bash
cd /mnt/c/Headquarters/Projects/PcBuilder/backend
~/.bun/bin/bun test
```

Expected output when all tests pass:

```
50 pass, 0 fail
114 expect() calls
Ran 50 tests across 3 files
```

### Test files

| File | Tests | What it covers |
|---|---|---|
| `src/__tests__/compatibilityService.test.ts` | 24 | All 6 compatibility rules and edge cases |
| `src/middleware/__tests__/auth.test.ts` | 7 | JWT middleware — missing/expired/invalid tokens |
| `src/middleware/__tests__/validate.test.ts` | 19 | Zod validation — all 7 categories, missing fields, invalid enums |

## Running the development server

> The server entry point (`src/server.ts`) has not been created yet. Once it exists:

```bash
# In WSL2
cd /mnt/c/Headquarters/Projects/PcBuilder/backend
~/.bun/bin/bun --hot src/server.ts
```

`--hot` enables hot reload — the server restarts automatically when you save a file.

## Running migrations

Run these once to set up the database. Safe to re-run (uses `IF NOT EXISTS`).

```bash
# In WSL2
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/001_create_components.sql
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/002_create_retailers.sql
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/003_create_prices.sql
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/004_create_scraper_logs.sql
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/005_create_admins.sql
```

## Environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp backend/.env.example backend/.env
```

Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for signing JWT tokens — use a long random string |
| `JWT_EXPIRES_IN` | Token expiry duration, e.g. `8h` |

> Never commit `.env` to Git. It is already in `.gitignore`.

## Installing dependencies

```bash
# In WSL2
cd /mnt/c/Headquarters/Projects/PcBuilder/backend
~/.bun/bin/bun install
```

## Why test files show errors in VS Code

Test files import from `bun:test`:

```typescript
import { test, expect, describe } from 'bun:test';
```

`bun:test` is only available when running inside Bun (WSL2). VS Code's TypeScript server runs on Windows where Bun isn't installed. To prevent red squiggles, test directories are excluded from the main `tsconfig.json`:

```json
"exclude": ["node_modules", "src/**/__tests__/**", "src/__tests__/**"]
```

The tests still run perfectly in WSL2 — this only affects the editor's type checking.

## Regenerating UML diagrams

```bash
# From the project root (requires Java)
java -DPLANTUML_LIMIT_SIZE=8192 -jar docs/plantuml.jar -tpng notes/diagrams/*.puml -o "../../docs/uml"
```

See [../diagrams/README.md](../diagrams/README.md) for more details.
