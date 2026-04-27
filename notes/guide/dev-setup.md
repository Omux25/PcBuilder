# Dev Setup

How to run the full stack locally (backend + frontend + database).

---

## Prerequisites

- Windows 11 with WSL2 (Ubuntu distro)
- Bun installed in WSL2 at `~/.bun/bin/bun`
- PostgreSQL installed in WSL2 (`sudo apt install postgresql`)
- VS Code with the WSL extension

---

## 1. Start PostgreSQL

PostgreSQL runs on port **5433** in this environment (not the default 5432).

```powershell
# Start the service (run once per WSL2 session)
wsl -d Ubuntu -- bash -c "echo '2525' | sudo -S service postgresql start"
```

To verify it's running:
```powershell
wsl -d Ubuntu -- bash -c "ss -tlnp | grep 5433"
```

---

## 2. Environment variables

The `.env` file is already created at `backend/.env`. It contains:

```env
PORT=3000
PGHOST=127.0.0.1
PGPORT=5433
PGDATABASE=pc_builder
PGUSER=pc_builder_user
PGPASSWORD=pc_builder_pass_2024
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRES_IN=8h
```

Bun loads `.env` automatically — no extra steps needed.

---

## 3. Run migrations (first time only)

```powershell
wsl -d Ubuntu -- bash -c "echo '2525' | sudo -S -u postgres psql -d pc_builder -f /mnt/c/Headquarters/Projects/PcBuilder/backend/src/db/migrations/001_create_components.sql"
wsl -d Ubuntu -- bash -c "echo '2525' | sudo -S -u postgres psql -d pc_builder -f /mnt/c/Headquarters/Projects/PcBuilder/backend/src/db/migrations/002_create_retailers.sql"
wsl -d Ubuntu -- bash -c "echo '2525' | sudo -S -u postgres psql -d pc_builder -f /mnt/c/Headquarters/Projects/PcBuilder/backend/src/db/migrations/003_create_prices.sql"
wsl -d Ubuntu -- bash -c "echo '2525' | sudo -S -u postgres psql -d pc_builder -f /mnt/c/Headquarters/Projects/PcBuilder/backend/src/db/migrations/004_create_scraper_logs.sql"
wsl -d Ubuntu -- bash -c "echo '2525' | sudo -S -u postgres psql -d pc_builder -f /mnt/c/Headquarters/Projects/PcBuilder/backend/src/db/migrations/005_create_admins.sql"
```

---

## 4. Seed sample data (first time only)

```powershell
wsl -d Ubuntu -- bash -c "echo '2525' | sudo -S -u postgres psql -d pc_builder -f /mnt/c/Headquarters/Projects/PcBuilder/backend/seed.sql"
```

This inserts: 3 retailers, 29 components (5 CPUs, 4 motherboards, 5 GPUs, 4 RAM, 3 storage, 4 PSUs, 4 cases), sample prices, and an admin account.

Admin credentials: `admin` / `admin123`

---

## 5. Start the backend

```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun --hot src/server.ts"
```

Expected output: `Server running on http://localhost:3000`

`--hot` enables hot reload — the server restarts automatically on file save.

---

## 6. Start the frontend

Open a second terminal:

```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/frontend && ~/.bun/bin/bun run dev"
```

Expected output: `VITE ready — Local: http://localhost:5173/`

Then open **http://localhost:5173** in your browser.

The Vite dev server proxies all `/api` requests to the backend automatically (configured in `vite.config.ts`).

---

## 7. Run tests

```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun test 2>&1"
```

Expected: **229 pass, 0 fail** across 23 files.

Test categories:
- Unit tests — compatibility engine, middleware, services, routes
- Integration tests — edge cases (404, 401, validation), scraping cycle
- Property-based tests (fast-check) — all 11 correctness properties

---

## 8. Install dependencies

```powershell
# Backend
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun install"

# Frontend
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/frontend && ~/.bun/bin/bun install"
```

---

## Why test files show errors in VS Code

Test files import from `bun:test` which is only available inside Bun (WSL2). VS Code's TypeScript server runs on Windows where Bun isn't installed. Test directories are excluded from `tsconfig.json` to prevent red squiggles — the tests still run perfectly in WSL2.

---

## Regenerating UML diagrams

```bash
# From the project root (requires Java + plantuml.jar)
java -DPLANTUML_LIMIT_SIZE=8192 -jar plantuml.jar -tpng notes/diagrams/*.puml -o rendered
```

See [../diagrams/README.md](../diagrams/README.md) for details.
