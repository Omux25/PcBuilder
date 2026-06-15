# Frontend Codemap

**Freshness Timestamp:** 2026-06-15T16:10:00Z

## Client Configurator (`apps/frontend/src/`)
The primary client-facing application is structured under `apps/frontend/src/`:

- `context/BuildContext.tsx`: Global configuration state provider. Restores active configurations from localStorage, URL parameters, or queries the shortener endpoint `getSharedBuild` on backend when detecting `?s=id`.
- `components/`:
  - `Configurator.tsx`: Main builder screen. Shows selected slots, total estimates, TDP consumption meters, and alerts.
  - `ConfiguratorTotals.tsx`: Sidebar actions panel for reset, PDF exports, and share modals triggers.
  - `ShareModal.tsx`: Premium dark glassmorphic dialog. Renders shortened links, QR codes, messenger redirects, and copy mechanism.
- `utils/`:
  - `exportFormatter.ts`: Layout compiler. Formats selected slots and prices into Reddit tables, Discord plain list, or BBCode templates.
  - `buildUrl.ts`: Compact slots-to-IDs parsing helper for immediate offline sharing.
- `api.ts`: Fetch wrapper client interfacing with public endpoints.

## Admin Dashboard (`apps/admin/src/`)
The operational catalog panel is structured under `apps/admin/src/`:

- `pages/`:
  - `Unmatched.tsx`: Primary curation screen. Renders unmatched listings tab bars, filter controls, reprocess triggers, and accordion groups.
  - `KeywordRules.tsx`: Control panel for managing matching regexes and keyword priorities.
- `components/`:
  - `CategoryAccordion.tsx`: Collapsible category grouping container. Handles lazy loading pages and category-scoped confirmations.
  - `CanonicalGroupRow.tsx`: One expandable row inside the accordion. Recalculates group confidence and handles manual linking prompts.
  - `SearchOverrideView.tsx`: Global flat cross-category search view for unmatched components.
  - `TokenPicker.tsx`: Interactive component rendering words in scraped titles as clickable keyword rule triggers.
