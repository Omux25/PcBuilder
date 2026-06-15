# PC Builder Morocco - Operations & Deployment Guide (RUNBOOK.md)

This runbook describes the deployment, monitoring, troubleshooting, and recovery procedures for the PC Builder application.

---

## ── Deployment Procedures ──────────────────────────────────────────────────────

The application can be deployed either as a multi-container Docker cluster (recommended) or as a native node process managed by PM2.

### Option A: Containerized Deployment (Docker Compose)
Docker Compose orchestrates PostgreSQL, Hono backend, static frontend, and Certbot for SSL.

#### 1. Setup Environment
Define your secrets and config in the environment before deploying. Create an `.env` file at the root:
```env
DB_NAME=pc_builder
DB_USER=pc_builder_user
DB_PASSWORD=your_super_secure_db_password
JWT_SECRET=your_32_character_signing_key_secret
ALLOWED_ORIGINS=https://pcbuilder.ma,https://admin.pcbuilder.ma
NODE_ENV=production
```

#### 2. Run the Stack
Build the multi-stage Docker image and start all services in detached mode:
```bash
docker compose up -d --build
```
This boots:
1. **`postgres`**: Mounts persistent data to `postgres_data` volume and runs on port `5432`.
2. **`backend`**: Exposes port `3000`. It automatically runs migrations (`bun run migrate`) before starting Hono.
3. **`nginx`**: Acts as a reverse proxy forwarding requests to the backend.
4. **`certbot`**: Handles TLS certificate renewal automatically every 12 hours.

---

### Option B: Native Deployment (PM2)
If you prefer deploying natively on the server without Docker:

#### 1. Install PM2
```bash
npm install -g pm2
```

#### 2. Build Assets
Compile static files for the frontend portal and admin dashboard:
```bash
# In apps/frontend
bun run build

# In apps/admin
bun run build
```

#### 3. Run Backend via PM2
Create an `ecosystem.config.cjs` at the root and start the application:
```javascript
module.exports = {
  apps: [
    {
      name: 'pc-builder-backend',
      script: 'apps/backend/src/server.ts',
      interpreter: 'bun',
      env: {
        PORT: 3000,
        NODE_ENV: 'production',
        SERVE_STATIC: 'true',
        // other envs...
      }
    }
  ]
};
```
Start PM2:
```bash
pm2 start ecosystem.config.cjs
```

---

## ── Monitoring & Alerts ────────────────────────────────────────────────────────

Keep the application healthy by checking the following components:

### 1. Health Endpoint
Check if Hono backend is responsive:
```bash
curl -I http://localhost:3000/api/health
```
A healthy response returns `200 OK`.

### 2. Container Health
Verify container healthchecks defined in Docker Compose:
```bash
docker ps
```
The `postgres` container should show `(healthy)`.

### 3. Log Inspection
- View backend logs:
  ```bash
  docker compose logs -f backend
  ```
- View Nginx access/error logs:
  ```bash
  docker compose logs -f nginx
  ```

---

## ── Common Issues & Fixes ──────────────────────────────────────────────────────

### 1. Database Connection Failures
- **Symptom**: Backend logs show `DB connection failed` or container restart loops.
- **Check**: Verify `PGHOST`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE` environment variables match exactly what is set in `postgres`.
- **Fix**: Check if the postgres container is running and healthy: `docker compose ps`. Restart postgres if needed: `docker compose restart postgres`.

### 2. JWT Secret is Unset or Too Short
- **Symptom**: Backend server crashes immediately on startup.
- **Check**: Look for `JWT_SECRET must be at least 32 characters` in backend logs.
- **Fix**: Ensure your `JWT_SECRET` environment variable is defined and has at least 32 characters.

### 3. Retailer Scrapers Skipping
- **Symptom**: Log message `Retailer "X" not found in DB — skipping scraper`.
- **Fix**: The scrapers rely on retailer URLs mapped inside the database. Access the admin dashboard, navigate to **Revendeurs**, and add the retailer site URL or identifier there.

---

## ── Rollback Procedures ────────────────────────────────────────────────────────

If a deployment goes wrong, perform the following rollback steps:

### 1. Revert Source Code
Reset git to the previous stable release commit:
```bash
git reset --hard <stable_commit_hash>
```

### 2. Re-Build and Re-Deploy
Rebuild the container image using the reverted code:
```bash
docker compose up -d --build backend
```

### 3. Database Migration Rollback
If a database migration caused issues:
- Migrations are idempotent and cumulative. If you need to rollback manually, run a database rollback command or script, or restore from the latest snapshot backup:
```bash
# Stop backend
docker compose stop backend
# Restore Postgres database from pg_dump backup
docker exec -i <db_container_name> psql -U pc_builder_user -d pc_builder < backup.sql
# Start backend
docker compose start backend
```
