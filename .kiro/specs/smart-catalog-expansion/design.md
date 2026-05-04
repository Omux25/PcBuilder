# Design Document

## Overview

The Smart Catalog Expansion Engine is built on one core insight: **the catalog is already the dictionary**. The existing `componentMatcher.ts` DNA matcher, `catalogBuilder.ts` spec extractor, and `inferCategory` utility already do most of the heavy lifting. This feature wires them together into an admin-facing workflow rather than building parallel systems.

The implementation is purely additive — new files, new routes, new migrations, new UI components. Nothing existing is modified except `session.ts` (one new function call at the end) and `shared/types.ts` (two new category values).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Scrape Session (session.ts)                            │
│  aggregate() → autoMap() → buildFromUnmatched()         │
│                                    ↓ NEW                │
│                          runSuggestionPreprocessing()   │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│  suggestionEngine.ts (NEW)                              │
│  - deriveCanonicalName(scrapedName) → string            │
│  - extractBrandFromName(scrapedName) → string|null      │
│  - suggestForListing(listing, catalog) → Suggestion     │
│    1. DNA match via findBestMatch() (existing)          │
│    2. Keyword scorer fallback (new, pure function)      │
│  - processBatch(listings, catalog) → Map<id,Suggestion> │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│  unmatched_suggestions table (NEW migration 023)        │
│  id, unmatched_listing_id, category, confidence,        │
│  canonical_name, brand, existing_component_id,          │
│  specs_hint JSONB, computed_at                          │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│  New Admin API routes (NEW file: admin/suggestions.ts)  │
│  GET  /api/admin/unmatched-listings/grouped             │
│  POST /api/admin/unmatched-listings/reprocess           │
│  POST /api/admin/unmatched-listings/bulk-dismiss        │
│  POST /api/admin/unmatched-listings/bulk-approve        │
│  POST /api/admin/unmatched-listings/create-and-link     │
│  POST /api/admin/scrapers/scrape-urls                   │
└─────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────┐
│  Admin UI — Unmatched.tsx (ENHANCED)                    │
│  - Grouped view by canonical_name                       │
│  - Suggestion badges (confidence color-coded)           │
│  - Create & Link modal (pre-filled form)                │
│  - Bulk Approve / Bulk Dismiss                          │
│  - "Fetch prices now" post-link action                  │
└─────────────────────────────────────────────────────────┘
```

---

## Database Changes

### Migration 023 — New categories + fan/thermal_paste columns + suggestions table

```sql
-- 1. Extend category CHECK constraint
ALTER TABLE components DROP CONSTRAINT IF EXISTS components_category_check;
ALTER TABLE components ADD CONSTRAINT components_category_check
  CHECK (category IN (
    'cpu','motherboard','gpu','ram','storage','psu','case','cooling',
    'fan','thermal_paste'
  ));

-- 2. Fan-specific columns
ALTER TABLE components
  ADD COLUMN IF NOT EXISTS size_mm         SMALLINT,
  ADD COLUMN IF NOT EXISTS airflow_cfm     NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS noise_db        NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS rgb             BOOLEAN,
  ADD COLUMN IF NOT EXISTS pack_size       SMALLINT;

-- 3. Thermal paste-specific columns
ALTER TABLE components
  ADD COLUMN IF NOT EXISTS weight_grams        NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS thermal_conductivity NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS paste_type          VARCHAR(20)
    CHECK (paste_type IN ('paste','liquid_metal','pad'));

-- 4. Suggestion cache table
CREATE TABLE IF NOT EXISTS unmatched_suggestions (
  id                    SERIAL PRIMARY KEY,
  unmatched_listing_id  INTEGER NOT NULL UNIQUE
                          REFERENCES unmatched_listings(id) ON DELETE CASCADE,
  category              VARCHAR(50),
  confidence            VARCHAR(10) NOT NULL CHECK (confidence IN ('high','medium','low')),
  canonical_name        VARCHAR(500) NOT NULL,
  brand                 VARCHAR(100),
  existing_component_id INTEGER REFERENCES components(id) ON DELETE SET NULL,
  specs_hint            JSONB,
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unmatched_suggestions_listing
  ON unmatched_suggestions(unmatched_listing_id);
CREATE INDEX IF NOT EXISTS idx_unmatched_suggestions_confidence
  ON unmatched_suggestions(confidence);
CREATE INDEX IF NOT EXISTS idx_unmatched_suggestions_canonical
  ON unmatched_suggestions(canonical_name);
```

No existing migrations are touched. All new columns are nullable so existing rows are unaffected.

---

## Suggestion Engine Design

### File: `apps/backend/src/services/suggestionEngine.ts`

This is a pure-function module — no DB access, no side effects. The DB layer calls it and persists results.

```typescript
export interface Suggestion {
  category: ComponentCategory | 'fan' | 'thermal_paste' | null;
  confidence: 'high' | 'medium' | 'low';
  canonical_name: string;
  brand: string | null;
  existing_component_id: number | null;
  specs_hint: Record<string, unknown>;
}

export function suggestForListing(
  scrapedName: string,
  catalog: CatalogComponent[],
): Suggestion
```

**Step 1 — Canonical name derivation** (pure, no DB):
- Strip brand using the existing `extractBrand()` from `@shared/component-utils`
- Strip color tokens: `Noir|Blanc|Black|White|Blanche|Noire|Rouge|Red|Blue|Bleu|Silver|Argent|Gold|Or`
- Strip noise tokens: `Kit|Bundle|Pack|Combo|OEM|Retail|Box|Edition|Version`
- Normalize whitespace

**Step 2 — DNA match against catalog** (reuses existing `findBestMatch`):
- Run `findBestMatch(scrapedName, catalog, PERFECT_THRESHOLD)` → `confidence: "high"`, populate `existing_component_id`
- If no perfect match, run `findBestMatch(scrapedName, catalog, PARTIAL_THRESHOLD)` → `confidence: "medium"`, populate `existing_component_id`
- If still no match → fall through to Step 3

**Step 3 — Keyword scorer fallback** (pure, no DB):
- Score the scraped name against 10 keyword sets (one per category)
- Return highest-scoring category with `confidence: "medium"` if clear winner, else `confidence: "low"`

**Step 4 — Specs hint** (reuses existing extractors from `@shared/component-utils`):
- If category is known, call the matching `extract*Specs()` function
- Return result as `specs_hint` for pre-filling the admin form

### Keyword sets (hardcoded, covers the actual queue data)

```typescript
const KEYWORD_SETS: Record<string, string[]> = {
  cooling:       ['aio','liquid','radiator','kraken','h100','h115','h150','h170','le720','lq360','mystique','galahad','coreliquid','mirage','freezer ii','pure loop'],
  fan:           ['120mm','140mm','200mm','pwm','airflow','cfm','case fan','chassis fan','f120','f140','ll120','ql120','fd12','fd14','fk120','light wings'],
  thermal_paste: ['thermal','paste','grizzly','kryonaut','conductonaut','hydronaut','aeronaut','mx-4','mx-6','mx-7','carbonaut','kryosheet','pate thermique'],
  case:          ['tower','boitier','boîtier','tempered glass','tg argb','mid tower','full tower','mini itx','h510','h710','o11','torrent','north','4000x','5000x'],
  motherboard:   ['b450','b550','b650','b760','b850','x570','x670','z690','z790','z890','a520','a620','h610','h670','h770','prime b','prime x','tuf gaming b','rog strix b','aorus elite','tomahawk','mortar'],
  storage:       ['nvme','ssd','hdd','m.2','pcie','sata','barracuda','firecuda','sn850','nm790','ns100','870 evo','980 pro','990 pro','nv2','a400'],
  ram:           ['ddr4','ddr5','mhz','vengeance','ripjaws','trident','fury beast','t-force','ares ddr','cl16','cl30','cl36'],
  psu:           ['watt','850w','1000w','750w','650w','modular','80+','gold','platinum','titanium','rm850','hx1000','focus gx','straight power','pure power','toughpower'],
  gpu:           ['rtx','gtx','radeon','rx 6','rx 7','rx 9','geforce','vram','gddr6','graphics'],
  cpu:           ['ryzen','core i','core ultra','threadripper','socket am','lga1700','lga1851','ghz','cores','threads'],
};
```

---

## Pre-Processing Job Design

### File: `apps/backend/src/services/suggestionPreprocessor.ts`

```typescript
export async function runSuggestionPreprocessing(): Promise<{ processed: number; skipped: number }>
```

**Algorithm:**
1. Load all active catalog components once (single query)
2. Fetch all pending listings that have no suggestion or suggestion older than 24h
3. For each listing, call `suggestForListing()` (pure, no DB)
4. Batch-upsert results into `unmatched_suggestions` using `ON CONFLICT (unmatched_listing_id) DO UPDATE`
5. Log summary

**Integration point in `session.ts`** — one new line after `buildFromUnmatched()`:
```typescript
await runSuggestionPreprocessing();
```

The function signature of `runScrapingSession()` does not change.

---

## New API Routes

### File: `apps/backend/src/routes/admin/unmatchedSuggestions.ts`

All routes use the existing `authMiddleware`. Mounted at `/api/admin/unmatched-listings`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/grouped` | Pending listings grouped by `canonical_name`, with suggestion data |
| `POST` | `/reprocess` | Trigger suggestion pre-processing on demand |
| `POST` | `/bulk-dismiss` | Dismiss array of listing IDs |
| `POST` | `/bulk-approve` | Link all high-confidence groups to their existing matches |
| `POST` | `/create-and-link` | Create new component + link all listings in a canonical group |

### File: `apps/backend/src/routes/admin/scraperUrls.ts`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/scrapers/scrape-urls` | Trigger targeted scrape for specific URLs |

---

## `GET /grouped` Response Shape

```typescript
interface GroupedUnmatchedResponse {
  groups: CanonicalGroup[];
  total_groups: number;
  total_listings: number;
}

interface CanonicalGroup {
  canonical_name: string;
  brand: string | null;
  category: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  existing_component_id: number | null;
  existing_component_name: string | null;
  specs_hint: Record<string, unknown>;
  retailer_count: number;
  listing_count: number;
  price_min: number | null;
  price_max: number | null;
  listings: UnmatchedListingRow[];
}

interface UnmatchedListingRow {
  id: number;
  retailer_id: number;
  retailer_name: string;
  scraped_name: string;
  scraped_price: number | null;
  product_url: string;
  scraped_at: string;
}
```

Listings with no suggestion entry are grouped under their raw `scraped_name` with `confidence: "unknown"`.

---

## `POST /create-and-link` Request/Response

```typescript
// Request
interface CreateAndLinkRequest {
  // Component to create
  name: string;
  brand: string;
  category: string;
  specs: Record<string, unknown>; // category-specific fields
  // Listings to link (all IDs in the canonical group)
  listing_ids: number[];
}

// Response
interface CreateAndLinkResponse {
  component_id: number;
  component_slug: string;
  linked_count: number;
  scraper_mapping_ids: number[];
}
```

The handler executes everything in a single `sql.begin()` transaction. On any error, the transaction rolls back and HTTP 500 is returned.

---

## `POST /bulk-approve` Request/Response

```typescript
// Request — array of canonical group keys to approve
interface BulkApproveRequest {
  canonical_names: string[]; // approve all high-confidence groups with these names
}

// Response
interface BulkApproveResponse {
  approved_groups: number;
  linked_listings: number;
  skipped_groups: number; // groups that were not high-confidence or had no existing_match
}
```

---

## Frontend Design

### Enhanced `Unmatched.tsx`

The page gains a **view toggle**: "Grouped" (default) vs "Flat" (existing behavior, unchanged).

**Grouped view data flow:**
1. On mount, call `GET /api/admin/unmatched-listings/grouped`
2. Render `<CanonicalGroupRow>` for each group
3. Expand a group → show individual listing rows
4. Click "Create & Link" → open `<CreateAndLinkModal>` pre-filled from group data
5. Click "Link to existing" (when `existing_component_id` present) → call `/create-and-link` with `link_to_existing: true`
6. Select groups + click "Dismiss selected" → call `/bulk-dismiss`
7. Click "Bulk Approve" → call `/bulk-approve` with all visible high-confidence group names

### New components

| Component | Purpose |
|-----------|---------|
| `ConfidenceBadge.tsx` | Green/yellow/grey badge showing confidence level |
| `CanonicalGroupRow.tsx` | Expandable group row with suggestion data |
| `CreateAndLinkModal.tsx` | Pre-filled component creation form with category-specific spec fields |
| `FanSpecFields.tsx` | Fan-specific form section (size_mm, rgb, pack_size, etc.) |
| `ThermalPasteSpecFields.tsx` | Thermal paste form section (weight_grams, paste_type, etc.) |

### `CreateAndLinkModal` form logic

1. Pre-fill `name`, `brand`, `category` from suggestion
2. Pre-fill spec fields from `specs_hint`
3. If `existing_component_id` present → show "Link to existing" as primary CTA
4. If admin overrides a `high`-confidence category → show confirmation step
5. On submit → POST `/create-and-link` → show success toast with "Fetch prices now" button

---

## Shared Types Changes

### `shared/types.ts` — two additions only

```typescript
// Before
export type ComponentCategory =
  | 'cpu' | 'motherboard' | 'gpu' | 'ram'
  | 'storage' | 'psu' | 'case' | 'cooling';

// After
export type ComponentCategory =
  | 'cpu' | 'motherboard' | 'gpu' | 'ram'
  | 'storage' | 'psu' | 'case' | 'cooling'
  | 'fan' | 'thermal_paste';

// CATEGORY_LABELS additions
fan: 'Ventilateur',
thermal_paste: 'Pâte thermique',

// CATEGORY_ORDER additions (appended at end)
'fan', 'thermal_paste'
```

The `Component` interface gains the new optional fields:
```typescript
size_mm?: number;
airflow_cfm?: number;
noise_db?: number;
rgb?: boolean;
pack_size?: number;
weight_grams?: number;
thermal_conductivity?: number;
paste_type?: 'paste' | 'liquid_metal' | 'pad';
```

---

## Correctness Properties

1. **No wrong-category mapping** — `suggestForListing()` is a pure function; given the same catalog state it always returns the same result. Tests can verify specific scraped names always map to the correct category.

2. **Color variant collapse** — `deriveCanonicalName("DeepCool AK400 Noir")` === `deriveCanonicalName("DeepCool AK400 Blanc")` === `"AK400"`. Property: for any two scraped names differing only by stripped tokens, canonical names are equal.

3. **No duplicate components** — `POST /create-and-link` checks for existing `canonical_name + category + brand` before INSERT. The DB `slug` UNIQUE constraint is the final guard.

4. **Atomic create-and-link** — the entire operation runs in a single transaction. Either all rows are created/updated or none are.

5. **No regressions** — the existing `GET /api/admin/unmatched-listings` route is untouched. The flat view in the UI remains available. All 606 existing tests must pass after every task.

---

## Property-Based Tests

```typescript
// Property 1: canonical name is idempotent
// deriveCanonicalName(deriveCanonicalName(x)) === deriveCanonicalName(x)

// Property 2: color variants collapse
// for any name N and color suffix C in COLOR_TOKENS:
// deriveCanonicalName(N + " " + C) === deriveCanonicalName(N)

// Property 3: suggestion engine is pure
// suggestForListing(name, catalog) called twice returns identical result

// Property 4: batch = individual
// processBatch([id1, id2], catalog) produces same results as
// suggestForListing(name1, catalog) + suggestForListing(name2, catalog)

// Property 5: no cross-category false positives
// a scraped name that is clearly a PSU (contains "850W") should never
// be suggested as a motherboard, even if it contains a chipset-like number
```
