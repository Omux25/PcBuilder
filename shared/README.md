# 📦 Shared Library — PC Builder Morocco

The core business logic, type definitions, and hardware specifications shared between the frontend, backend, and admin applications.

---

## 🏗️ Contents

### 📂 [**`hardware/`**](./hardware)
Centralized source of truth for hardware-related data.
- [**`specs/`**](./hardware/specs) — Type-safe specifications for every component category (CPU, GPU, PSU, etc.).
- [**`categories.ts`**](./hardware/categories.ts) — Taxonomy of PC components.
- [**`brands.ts`**](./hardware/brands.ts) — Canonical list of hardware manufacturers.
- [**`cleaning.ts`**](./hardware/cleaning.ts) — Utilities for normalizing messy raw data from scrapers.

### ⚙️ [**`compatibility-engine.ts`**](./compatibility-engine.ts)
The complex logic that determines if a set of PC components are compatible.
- Socket matching (CPU + Motherboard).
- Dimension checking (GPU length vs Case clearance).
- Power estimation (Total TDP vs PSU wattage).
- RAM compatibility (DDR version, slot counts).

### 🧬 [**`types.ts`**](./types.ts)
Universal TypeScript interfaces and types for the entire monorepo.

### 🛠️ Utilities
- [**`api-client.ts`**](./api-client.ts) — Shared API interaction logic.
- [**`brand-authority.ts`**](./brand-authority.ts) — Logic for identifying brands from raw text.
- [**`image-utils.ts`**](./image-utils.ts) — Handling component images and fallbacks.

---

## 🚀 Usage

This package is not published; it is consumed directly by other applications in the monorepo via relative imports (e.g., `import { ... } from '@shared/types'`).

---

## 🧪 Development

When modifying code in `shared`, be aware that it affects:
1. **Frontend:** Real-time validation in the configurator.
2. **Backend:** Data persistence and scraper normalization.
3. **Admin:** Data auditing and manual matching.

Always run linting and tests across all apps after changing `shared`.
