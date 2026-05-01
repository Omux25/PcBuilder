# PC Builder — Admin Panel

A separate React + Vite application for platform administrators. Runs on port 5174 in development, served at `/admin` in production.

---

## What's in here

```
admin/src/
├── api.ts              ← Auth-aware fetch wrapper (attaches Bearer token, handles 401 → refresh)
├── router.tsx          ← All admin routes
├── App.tsx             ← Root component
└── pages/
    ├── Login.tsx        ← Email + password login form
    ├── Dashboard.tsx    ← Stats cards, price chart, recent activity feed
    ├── Components.tsx   ← Component list, create/edit form, deactivate/delete
    ├── BulkImport.tsx   ← CSV/JSON file upload with preview and validation
    ├── Retailers.tsx    ← Retailer management
    ├── Scrapers.tsx     ← Scraper status, run now, log viewer
    ├── Unmatched.tsx    ← Unmatched listings — link or dismiss
    └── Presets.tsx      ← Preset build management
```

## Running

```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/admin && ~/.bun/bin/bun run dev"
```

Or use `dev.ps1` from the project root to start all three services at once.

Open http://localhost:5174/admin — default credentials: `admin` / `admin123`

## Building for production

```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/admin && ~/.bun/bin/bun run build"
```

Output goes to `admin/dist/`. In production, nginx serves this directory at `/admin`.

## Authentication

The admin panel uses a two-token system:
- **Access token** (15 min JWT) — stored in memory, attached to every API request
- **Refresh token** (7 days) — stored in an HttpOnly cookie, used to get new access tokens

The API client in `api.ts` handles refresh automatically. On a 401 response, it calls `POST /api/auth/refresh` and retries the original request. If refresh fails, it redirects to `/admin/login`.
