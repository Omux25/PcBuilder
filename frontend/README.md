# PC Builder — Frontend

The user-facing React + Vite application. Runs on port 5173 in development.

---

## What's in here

```
frontend/src/
├── api.ts                    ← API client (fetch wrappers for all endpoints)
├── types.ts                  ← TypeScript interfaces + CATEGORY_LABELS + RULE_LABELS
├── App.tsx                   ← Root component, layout, build state
├── index.css                 ← Global CSS reset and design tokens (CSS variables)
├── components/
│   ├── Configurator.tsx      ← 8 component slots, each with a ComponentPicker
│   ├── ComponentPicker.tsx   ← Searchable dropdown with compatibility filtering
│   ├── BuildSummary.tsx      ← TDP, PSU recommendation, errors, warnings
│   ├── PriceComparison.tsx   ← Price table with variant column, in/out-of-stock grouping
│   └── PriceHistoryChart.tsx ← Recharts line chart for price history
└── pages/
    └── ComponentDetail.tsx   ← Component detail page (/components/:slug)
```

## Running

```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/frontend && ~/.bun/bin/bun run dev"
```

Or use `dev.ps1` from the project root to start all three services at once.

The Vite dev server proxies all `/api` requests to `http://localhost:3000` — no CORS issues in development.

## Building for production

```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/frontend && ~/.bun/bin/bun run build"
```

Output goes to `frontend/dist/`. In production, nginx serves this directory at `/`.
