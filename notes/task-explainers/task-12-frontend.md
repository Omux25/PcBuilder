# Task 12 — React Frontend

## What was built

A complete React + Vite + TypeScript frontend for the PC Builder platform.

---

## Files created

```
frontend/src/
├── types.ts                          — TypeScript interfaces (Component, PriceOffer, etc.)
├── api.ts                            — API client (fetch wrappers for all endpoints)
├── App.tsx                           — Root component, layout, state
├── App.module.css                    — App layout styles
├── index.css                         — Global CSS reset and design tokens
└── components/
    ├── Configurator.tsx              — 7 component slots with dropdowns
    ├── Configurator.module.css
    ├── BuildSummary.tsx              — TDP, PSU recommendation, errors, warnings
    ├── BuildSummary.module.css
    ├── PriceComparison.tsx           — Price table with retailer links
    └── PriceComparison.module.css
```

---

## Architecture

### State lives in `App.tsx`

```
App
├── build: BuildConfig          — { cpu?: Component, gpu?: Component, ... }
├── priceTarget: Component|null — which component's prices to show
│
├── Configurator  ← reads/writes build
├── BuildSummary  ← reads build, calls POST /api/compatibility/validate
└── PriceComparison ← reads priceTarget, calls GET /api/components/:id/prices
```

### API client (`api.ts`)

Four functions, all using the Vite dev proxy (`/api` → `http://localhost:3000`):

| Function | Endpoint |
|---|---|
| `getComponents(category?)` | `GET /api/components?category=...` |
| `getComponentById(id)` | `GET /api/components/:id` |
| `getPrices(componentId)` | `GET /api/components/:id/prices` |
| `validateBuild(build)` | `POST /api/compatibility/validate` |

### Vite proxy

`vite.config.ts` proxies `/api` to `http://localhost:3000` in development — no CORS issues, no hardcoded ports in the frontend code.

---

## Key features

**Configurator** — 7 dropdowns (one per category). Each fetches its component list from the API on mount. Selecting a component updates the build state. A ✕ button clears the slot.

**BuildSummary** — re-validates the build on every change. Shows:
- Compatible / Incompatible badge
- Total TDP and recommended PSU wattage
- Error list (red, with rule name)
- Warning list (amber, with rule name)

**PriceComparison** — shows a price table for the selected component. Rows are sorted cheapest first (the API guarantees this). The cheapest row is highlighted. Each row has a "Voir →" link that opens the retailer's product page in a new tab.

**Responsive layout** — two-column grid on desktop (≥900px), single column on mobile. Price table hides the "last updated" column on small screens.

---

## How to run

```bash
# Start the backend first (in WSL2)
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun run dev"

# Start the frontend (in WSL2 or PowerShell)
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/frontend && ~/.bun/bin/bun run dev"
```

Then open http://localhost:5173.
