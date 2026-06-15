# PC Builder Morocco - Development & Contribution Guide (CONTRIB.md)

Welcome to the PC Builder project! This document outlines how to set up the development environment, execute scripts, modify code, and run tests.

---

## ── Environment Setup ─────────────────────────────────────────────────────────

The backend application requires several environment variables for database connections, port bindings, security secrets, and client CORS configuration. 

### Copy Env File
Copy the example file to create your local environment file:
```bash
cp apps/backend/.env.example apps/backend/.env
```

### Environment Reference
The single source of truth for variables is `apps/backend/.env.example`:

| Environment Variable | Description | Default / Format |
| :--- | :--- | :--- |
| **`PORT`** | Port on which the backend server listens. | `3000` |
| **`PGHOST`** | Host address of PostgreSQL server. In docker compose, this should be `postgres`. | `127.0.0.1` |
| **`PGPORT`** | PostgreSQL server port. | `5432` |
| **`PGDATABASE`** | Target PostgreSQL database name. | `pc_builder` |
| **`PGUSER`** | PostgreSQL database connection username. | `pc_builder_user` |
| **`PGPASSWORD`** | PostgreSQL database connection password (leave blank for local docker dev). | *(Empty)* |
| **`JWT_SECRET`** | Secret key used to sign session/auth tokens. Must be at least 32 characters. | `change_me_in_production_min_32_chars` |
| **`ALLOWED_ORIGINS`** | Comma-separated list of allowed CORS origins. Use `*` to allow all in development. | `http://localhost:5173,http://localhost:5174` |
| **`NODE_ENV`** | Current server environment. | `development` or `production` |
| **`SERVE_STATIC`** | Set to `true` in production to serve frontend builds directly from the backend Hono server. | `false` |

*Note: You can generate a secure 32-character JWT secret key with `openssl rand -hex 32`.*

---

## ── Development Workflow ──────────────────────────────────────────────────────

The project is structured as a Bun/npm monorepo. It features a unified launcher script to bring up the database, backend, admin dashboard, and frontend portal simultaneously.

### Running Unified Stack
To start the database container, backend Hono server, frontend app, and admin dashboard concurrently:
```bash
npm run dev
# or
bun run dev
```

This runs the script `dev.ps1` which handles the following tasks:
1. **Auto-detect Docker & PostgreSQL**: If Docker is running, it automatically boots up the PostgreSQL service container (`postgres`) via `docker compose up -d postgres`.
2. **Auto-detect Native Bun vs WSL**: If Bun is installed on Windows, it boots the stack natively. Otherwise, it transparently forwards execution inside WSL2.
3. **Concurrently Launch**: Boots Hono, React client apps, and tailwind/vite compiler processes under color-coded outputs.

---

## ── Available Scripts Reference ────────────────────────────────────────────────

Here is a reference of all scripts available across the monorepo workspaces:

### Root Monorepo Workspace
Scripts defined in the root `package.json`:

| Script Name | Command | Description |
| :--- | :--- | :--- |
| **`dev`** | `powershell.exe -NoProfile -Command ".\dev.ps1"` | Launches the unified concurrently-run development stack. |
| **`test:backend`** | `cd apps/backend && bun test` | Executes the backend test suite. |
| **`lint:admin`** | `cd apps/admin && bun run lint` | Runs ESLint and checks files in the admin project. |
| **`lint:frontend`** | `cd apps/frontend && bun run lint` | Runs ESLint and checks files in the main user client frontend portal. |
| **`lint:all`** | `bun run lint:admin && bun run lint:frontend` | Lints all frontend/admin javascript/typescript files. |
| **`clean`** | *Recursive PowerShell cleanup* | Removes `node_modules` and `dist` build folders to reset the monorepo cache. |

### Backend Workspace (`apps/backend`)
Scripts defined in `apps/backend/package.json`:

| Script Name | Command | Description |
| :--- | :--- | :--- |
| **`start`** | `bun src/server.ts` | Runs the production backend. |
| **`dev`** | `bun --hot src/server.ts` | Runs the development backend with hot-reloads. |
| **`test`** | `bun test` | Runs backend unit and integration tests. |
| **`migrate`** | `bun src/core/db/migrate.ts` | Runs database schema migrations to sync the PostgreSQL instance. |
| **`sync`** | `bun scripts/sync_catalog.ts` | Syncs current retailer component pricing in the catalog database. |
| **`enrich`** | `bun scripts/enrich_database.ts` | Enriches scraped and unmatched listings with specifications. |

### Frontend Workspace (`apps/frontend`)
Scripts defined in `apps/frontend/package.json`:

| Script Name | Command | Description |
| :--- | :--- | :--- |
| **`dev`** | `vite` | Starts the Vite dev server for the user portal. |
| **`build`** | `node build.js` | Bundles the user portal files for production. |
| **`lint`** | `eslint .` | Runs ESLint checker on frontend codebase. |
| **`preview`** | `vite preview` | Previews the compiled frontend client build. |
| **`test`** | `bun test` | Runs frontend client unit tests. |

### Admin Dashboard Workspace (`apps/admin`)
Scripts defined in `apps/admin/package.json`:

| Script Name | Command | Description |
| :--- | :--- | :--- |
| **`dev`** | `vite` | Starts the Vite dev server for the Admin dashboard. |
| **`build`** | `vite build` | Compiles the Admin dashboard. |
| **`lint`** | `eslint .` | Runs ESLint check. |
| **`preview`** | `vite preview` | Previews the compiled Admin dashboard. |
| **`test`** | `bun test` | Runs admin unit tests. |

---

## ── Testing Procedures ────────────────────────────────────────────────────────

Testing ensures that hardware scraping pipelines, catalog parsing algorithms, and curated mappings remain accurate.

### Running Backend Tests
To run the full backend suite:
```bash
npm run test:backend
```
Or navigate to `apps/backend` and run:
```bash
bun test
```

### Running Frontend & Admin Tests
Navigate to their respective directory (`apps/frontend` or `apps/admin`) and run:
```bash
bun test
```
