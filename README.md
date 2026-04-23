# PC Builder Platform — Morocco

A full-stack web application for composing custom PC builds, validating component compatibility in real time, and comparing prices from Moroccan retailers.

## Project Structure

```
pc-builder/
├── backend/          # Node.js / Express REST API + scraping system
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── db/
│   │   │   ├── pool.js
│   │   │   └── migrations/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── schemas/
│   ├── scraper/
│   └── package.json
└── frontend/         # React.js SPA
```

## Prerequisites

- **WSL2** (Windows Subsystem for Linux 2) — backend runs inside WSL2
- **Bun** 1.3+ (inside WSL2): `curl -fsSL https://bun.sh/install | bash`
- **PostgreSQL** 15+ (inside WSL2 or via Docker)
- **Node.js** 20+ (Windows side, for the React frontend with Vite)

## Backend Setup (inside WSL2)

### 1. Install dependencies

```bash
cd backend
bun install
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env and fill in your database credentials and JWT secret
```

### 3. Create the database

```bash
psql -U postgres -c "CREATE DATABASE pc_builder;"
psql -U postgres -c "CREATE USER pc_builder_user WITH PASSWORD 'changeme';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE pc_builder TO pc_builder_user;"
```

### 4. Run migrations

Apply the SQL migration scripts in order:

```bash
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/001_create_components.sql
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/002_create_retailers.sql
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/003_create_prices.sql
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/004_create_scraper_logs.sql
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/005_create_admins.sql
```

### 5. Start the server

```bash
# Development (hot reload)
bun run dev

# Production
bun run start
```

The API will be available at `http://localhost:3000`.

## Running Tests

```bash
cd backend
bun test
```

## Frontend Setup

The React.js frontend will be initialized in a later task. See `frontend/README.md`.

## Environment Variables Reference

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP server port | `3000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | — |
| `DB_USER` | Database user | — |
| `DB_PASSWORD` | Database password | — |
| `DB_POOL_MAX` | Max pool connections | `10` |
| `DB_IDLE_TIMEOUT_MS` | Idle client timeout (ms) | `600000` |
| `DB_CONNECTION_TIMEOUT_MS` | Connection timeout (ms) | `30000` |
| `JWT_SECRET` | Secret for signing JWTs | — |
| `JWT_EXPIRES_IN` | JWT expiry duration | `8h` |
