# Requirements Document

## Introduction

The Smart Catalog Expansion Engine addresses a critical gap in the PC component price comparison platform: the catalog is incomplete, and admins have no efficient path to grow it from the unmatched listings queue. Currently 1,957 scraped products sit in `unmatched_listings` because the components they represent do not yet exist in the catalog.

The previous approach — a static Model Line Dictionary + Keyword Scorer — was discarded in favor of a simpler, more powerful design: **the catalog itself is the dictionary**. The existing DNA matcher (`componentMatcher.ts`) already knows how to match scraped names against catalog entries. The Suggestion Engine reuses it at a lower confidence threshold in "explain mode" to generate suggestions, rather than building a parallel lookup system.

This feature introduces five coordinated improvements:

1. A **Suggestion Engine** that runs the existing DNA matcher against the catalog to suggest category, canonical name, and existing component matches — reusing proven code, not reinventing it.
2. Two **new component categories** — `fan` and `thermal_paste` — with full DB, schema, and UI support.
3. An **enhanced Unmatched Admin UI** with a "Create & Link" flow, inline suggestion badges, bulk approve, bulk dismiss, and canonical name grouping.
4. A **pre-processing background job** that runs suggestions for all pending items in one pass and stores results, so the UI never computes suggestions on demand.
5. **Catalog naming standards** enforced through good defaults (pre-filled forms) rather than blocking warnings.

---

## Glossary

- **Suggestion_Engine**: The backend service that runs the existing DNA matcher against the active catalog to produce a category suggestion, canonical name, confidence level, existing component match, and pre-filled spec fields for a given scraped name.
- **DNA_Matcher**: The existing `componentMatcher.ts` utility (`findBestMatch`) that scores a scraped name against catalog components using token overlap. Reused as-is by the Suggestion_Engine.
- **Canonical_Name**: The normalized component name stored in the catalog. Format: model line + model number + key differentiator. Brand is stored separately. Color/language suffixes (Noir, Blanc, Black, White, Blanche, Noire) and noise tokens (Kit, Bundle, Pack, Combo, OEM, Retail, Box) are stripped.
- **Color_Variant**: A scraped product whose name differs from another only by a color or language suffix and whose specs are identical. Color variants map to the same catalog component.
- **Suggestion_Cache**: A DB table (`unmatched_suggestions`) that stores pre-computed suggestion results for each pending listing. Populated by the Pre-Processing Job, read by the UI.
- **Pre_Processing_Job**: A background job that runs the Suggestion_Engine against all pending unmatched listings and writes results to the Suggestion_Cache. Triggered after every scrape session and on demand by an admin.
- **Confidence_Level**: A three-value enum (`high`, `medium`, `low`). `high` = DNA matcher score ≥ PERFECT_THRESHOLD against an existing catalog component. `medium` = score ≥ PARTIAL_THRESHOLD or keyword scorer has a clear winner. `low` = no confident match found.
- **Existing_Match**: When the Suggestion_Engine finds a catalog component whose canonical name matches the derived canonical name of the scraped product, it returns that component as an existing match — meaning the admin should link to it rather than create a duplicate.
- **Create_And_Link_Flow**: The admin UI workflow that creates a new catalog component and simultaneously links all pending listings with the same canonical name to it, in a single atomic operation.
- **Bulk_Approve**: An admin action that approves all high-confidence suggestions on the current page in one click, creating components and links for each without individual review.
- **Bulk_Dismiss**: An admin action that dismisses multiple selected listings at once, used for non-component items (bundles, GPU brackets, accessories).
- **Canonical_Name_Group**: The set of all pending unmatched listings that produce the same canonical name after stripping color/language/noise tokens. This is the correct grouping unit — not exact scraped name.
- **Unmatched_Queue**: The admin view of all `unmatched_listings` rows with `status = 'pending'`, displayed in grouped view by default.
- **Admin**: An authenticated user of the admin panel with permission to manage the catalog and unmatched listings.
- **Fan**: A component category representing a standalone case or system fan. Spec fields: `size_mm`, `airflow_cfm`, `noise_db`, `rgb`, `pack_size`.
- **Thermal_Paste**: A component category representing thermal interface material. Spec fields: `weight_grams`, `thermal_conductivity`, `paste_type`.

---

## Requirements

### Requirement 1: Suggestion Engine — DNA Matcher Integration

**User Story:** As an admin reviewing an unmatched listing, I want the system to use the existing catalog to suggest the correct component match, so that I never have to maintain a separate lookup table and the suggestions improve automatically as the catalog grows.

#### Acceptance Criteria

1. THE Suggestion_Engine SHALL reuse the existing `findBestMatch` function from `componentMatcher.ts` without modifying it.
2. WHEN the Suggestion_Engine processes a scraped name, it SHALL first derive the Canonical_Name by stripping color, language, and noise tokens, then run `findBestMatch` against all active catalog components.
3. WHEN `findBestMatch` returns a score ≥ `SCRAPER_CONFIG.PERFECT_THRESHOLD`, THE Suggestion_Engine SHALL set `confidence: "high"` and populate `existing_match` with the matched component.
4. WHEN `findBestMatch` returns a score ≥ `SCRAPER_CONFIG.PARTIAL_THRESHOLD` but below `PERFECT_THRESHOLD`, THE Suggestion_Engine SHALL set `confidence: "medium"` and populate `existing_match` with the matched component.
5. WHEN `findBestMatch` returns no match above `PARTIAL_THRESHOLD`, THE Suggestion_Engine SHALL fall through to the Keyword_Scorer (Requirement 2) to determine category.
6. THE Suggestion_Engine SHALL derive the `brand` from the scraped name by checking it against a known brand list (ASUS, MSI, Gigabyte, Corsair, DeepCool, NZXT, Lian Li, be quiet!, Noctua, Arctic, Thermalright, Thermal Grizzly, Kingston, Samsung, WD, Seagate, Crucial, Lexar, G.Skill, TeamGroup, Aerocool, Mars Gaming, Thermaltake, Seasonic, Antec, Fractal, Cougar, APNX, Hybrok, XtrmLab, OCPC, PNY, Toshiba, ADATA).
7. THE Suggestion_Engine SHALL be a pure function: given the same scraped name and the same catalog state, it SHALL always return the same result.

### Requirement 2: Suggestion Engine — Keyword Scorer Fallback

**User Story:** As an admin reviewing a listing for a brand-new product not yet in the catalog, I want the system to make a best-effort category guess from keywords in the scraped name, so that the creation form is at least partially pre-filled.

#### Acceptance Criteria

1. WHEN the DNA matcher finds no match above `PARTIAL_THRESHOLD`, THE Keyword_Scorer SHALL score the scraped name against keyword sets for all ten categories: `cpu`, `gpu`, `ram`, `motherboard`, `storage`, `psu`, `case`, `cooling`, `fan`, `thermal_paste`.
2. WHEN the highest keyword score is strictly greater than all other category scores, THE Suggestion_Engine SHALL return that category with `confidence: "medium"` and no `existing_match`.
3. WHEN no category scores above zero, or two or more categories tie for the highest score, THE Suggestion_Engine SHALL return `confidence: "low"` with `category: null`.
4. THE Keyword_Scorer keyword sets SHALL cover at minimum: AIO/liquid/radiator/kraken/h100/h150 (cooling), socket/chipset/DDR/ATX/mATX/ITX (motherboard), NVMe/SSD/HDD/PCIe/SATA (storage), DDR4/DDR5/MHz/CL (ram), watt/modular/80+/gold/platinum (psu), tower/tempered/glass/mid/full/mini (case), fan/mm/PWM/airflow/CFM (fan), thermal/paste/grizzly/kryonaut/conductivity (thermal_paste).
5. THE Suggestion_Engine SHALL return a complete response within 50ms of being called (pure in-memory computation, no DB queries during scoring).

### Requirement 3: Suggestion Engine — Canonical Name Derivation

**User Story:** As an admin, I want the system to produce a clean canonical name that strips retailer noise and color variants, so that "DeepCool AK400 Noir" and "DEEPCOOL AK400 Blanc" both resolve to the same catalog entry "AK400" by DeepCool.

#### Acceptance Criteria

1. WHEN deriving a Canonical_Name, THE Suggestion_Engine SHALL strip the following color/language tokens (case-insensitive, whole-word): `Noir`, `Blanc`, `Black`, `White`, `Blanche`, `Noire`, `Rouge`, `Red`, `Blue`, `Bleu`, `Silver`, `Argent`, `Gold`, `Or`.
2. WHEN deriving a Canonical_Name, THE Suggestion_Engine SHALL strip the following noise tokens (case-insensitive, whole-word): `Kit`, `Bundle`, `Pack`, `Combo`, `OEM`, `Retail`, `Box`, `Edition`, `Version`.
3. WHEN deriving a Canonical_Name, THE Suggestion_Engine SHALL strip the detected brand name from the result (since brand is stored separately).
4. WHEN deriving a Canonical_Name, THE Suggestion_Engine SHALL normalize whitespace and trim after all stripping operations.
5. WHEN two scraped names differ only by stripped tokens, THE Suggestion_Engine SHALL produce identical Canonical_Names for both.
6. IF stripping all tokens results in an empty string, THE Suggestion_Engine SHALL return the original scraped name (minus the brand) as the fallback Canonical_Name.
7. THE Canonical_Name derivation SHALL be a pure function with no side effects and no DB access.

### Requirement 4: Pre-Processing Background Job

**User Story:** As an admin opening the unmatched queue, I want suggestion data to already be available for every listing without waiting, so that the page loads instantly with badges and groupings pre-computed.

#### Acceptance Criteria

1. THE System SHALL maintain a `unmatched_suggestions` table that stores one suggestion row per `unmatched_listing_id`, containing: `category`, `confidence`, `canonical_name`, `brand`, `existing_component_id` (nullable), `specs_hint` (JSONB), `computed_at`.
2. THE Pre_Processing_Job SHALL run automatically at the end of every scrape session, after the aggregator and auto-mapper have completed.
3. THE Pre_Processing_Job SHALL process only listings with `status = 'pending'` that either have no entry in `unmatched_suggestions` or have an entry older than 24 hours.
4. THE Pre_Processing_Job SHALL be triggerable on demand via a `POST /api/unmatched/reprocess` endpoint (admin-only), which runs the job synchronously and returns a summary of how many suggestions were computed.
5. WHEN the Pre_Processing_Job runs, it SHALL load all active catalog components once and reuse that snapshot for all listings in the batch — not query the DB per listing.
6. THE Pre_Processing_Job SHALL complete processing of 2,000 listings within 10 seconds.
7. IF the Pre_Processing_Job fails for an individual listing, it SHALL log the error and continue processing the remaining listings without aborting the entire batch.

### Requirement 5: New Component Category — Fan

**User Story:** As an admin, I want to create and manage standalone case fans as first-class catalog components, so that fan products scraped from retailers can be properly catalogued and price-compared.

#### Acceptance Criteria

1. THE System SHALL add `fan` as a valid value in the `components.category` CHECK constraint via a new database migration (≥ 023).
2. THE System SHALL add the following columns to the `components` table via the same migration: `size_mm` (smallint), `airflow_cfm` (numeric), `noise_db` (numeric), `rgb` (boolean), `pack_size` (smallint).
3. THE System SHALL validate fan components using a Zod schema that requires `name`, `brand`, and `size_mm`, and accepts `airflow_cfm`, `noise_db`, `rgb`, and `pack_size` as optional fields.
4. WHEN a fan component is submitted with a `size_mm` value not in `[80, 92, 120, 140, 200]`, THE System SHALL reject the request with HTTP 400 and a descriptive validation error.
5. THE System SHALL include `fan` in the `ComponentCategory` union type in `shared/types.ts` and in the `CATEGORY_LABELS` display map.
6. THE Admin_UI SHALL render a fan-specific spec form section when `fan` is selected as the category in the component creation or edit modal.
7. THE existing components API (`GET /api/components`, `POST /api/components`, `PUT /api/components/:id`) SHALL accept and return fan components without modification to their route handlers — only the validation layer changes.

### Requirement 6: New Component Category — Thermal Paste

**User Story:** As an admin, I want to create and manage thermal paste products as first-class catalog components, so that thermal interface materials scraped from retailers can be properly catalogued.

#### Acceptance Criteria

1. THE System SHALL add `thermal_paste` as a valid value in the `components.category` CHECK constraint via the same migration as Requirement 5.
2. THE System SHALL add the following columns to the `components` table via the same migration: `weight_grams` (numeric), `thermal_conductivity` (numeric), `paste_type` (varchar(20)).
3. THE System SHALL validate thermal paste components using a Zod schema that requires `name`, `brand`, and `weight_grams`, and accepts `thermal_conductivity` and `paste_type` as optional fields.
4. WHEN a thermal paste component is submitted with a `paste_type` value not in `["paste", "liquid_metal", "pad"]`, THE System SHALL reject the request with HTTP 400 and a descriptive validation error.
5. THE System SHALL include `thermal_paste` in the `ComponentCategory` union type in `shared/types.ts` and in the `CATEGORY_LABELS` display map.
6. THE Admin_UI SHALL render a thermal-paste-specific spec form section when `thermal_paste` is selected as the category in the component creation or edit modal.

### Requirement 7: Create & Link Flow

**User Story:** As an admin, I want to create a new catalog component and link all pending listings for that product in a single action, so that I can expand the catalog without leaving the unmatched queue page and without missing any retailer.

#### Acceptance Criteria

1. WHEN an admin opens a Canonical_Name_Group in the Unmatched_Queue, THE Admin_UI SHALL display the pre-computed suggestion (from Suggestion_Cache) including: category badge with confidence, canonical name, brand, and pre-filled spec fields.
2. THE Admin_UI SHALL allow the admin to override any pre-filled field (category, canonical name, brand, specs) before saving.
3. WHEN an admin submits the Create_And_Link form, THE System SHALL execute the following atomically in a single DB transaction: (a) INSERT the new component into `components`, (b) INSERT `scraper_mappings` rows for every listing in the Canonical_Name_Group, (c) UPDATE `status = 'linked'` and `linked_component_id` for all those listings, (d) DELETE their rows from `unmatched_suggestions`.
4. IF any step of the transaction fails, THE System SHALL roll back all changes and return HTTP 500 with a descriptive error — no partial state SHALL remain.
5. WHEN the Create_And_Link form is submitted and the suggestion includes an `existing_match`, THE Admin_UI SHALL prominently offer "Link to existing component" as the primary action, with "Create new component" as a secondary option.
6. WHEN the admin chooses "Link to existing component", THE System SHALL execute steps (b), (c), and (d) from criterion 3 only — no new component is created.
7. WHEN the Create_And_Link operation succeeds, THE Admin_UI SHALL close the modal, remove the group from the queue view, and display a success toast showing the component name and how many listings were linked.
8. WHEN the Create_And_Link operation succeeds, THE System SHALL trigger the Pre_Processing_Job for any remaining pending listings that share the same brand/category, so their suggestions are refreshed with the newly created component as a potential match.

### Requirement 8: Bulk Approve

**User Story:** As an admin facing a large backlog, I want to approve all high-confidence suggestions on the current page in one click, so that I can clear hundreds of items in minutes rather than hours.

#### Acceptance Criteria

1. THE Admin_UI SHALL display a "Bulk Approve" button on the Unmatched_Queue page that is enabled only when at least one visible group has `confidence: "high"` and an `existing_match`.
2. WHEN the admin clicks "Bulk Approve", THE Admin_UI SHALL show a confirmation dialog listing the number of groups and total listings that will be linked, grouped by category.
3. WHEN the admin confirms Bulk Approve, THE System SHALL process each high-confidence group as a "Link to existing component" operation (Requirement 7, criterion 6), all within a single DB transaction.
4. IF the Bulk Approve transaction fails, THE System SHALL roll back all changes and report which group caused the failure.
5. WHEN Bulk Approve completes, THE Admin_UI SHALL refresh the queue and display a summary toast: "X components linked across Y listings".
6. Bulk Approve SHALL only process groups with `confidence: "high"` — medium and low confidence groups SHALL require individual admin review.

### Requirement 9: Bulk Dismiss

**User Story:** As an admin, I want to dismiss multiple unmatched listings at once for known non-component items, so that I can clear bundles, GPU brackets, and accessories without clicking dismiss on each one.

#### Acceptance Criteria

1. THE Admin_UI SHALL provide checkboxes on each group row in the Unmatched_Queue for multi-selection.
2. WHEN at least one group is selected, THE Admin_UI SHALL show a "Dismiss selected" button with the count of selected groups.
3. WHEN the admin triggers bulk dismiss, THE Admin_UI SHALL display a confirmation dialog showing the count of groups and total listings that will be dismissed.
4. WHEN the admin confirms, THE System SHALL update `status = 'dismissed'` for all listings in the selected groups in a single DB operation and delete their `unmatched_suggestions` rows.
5. THE System SHALL expose a `POST /api/unmatched/bulk-dismiss` endpoint accepting an array of `unmatched_listing_id` values; it SHALL skip IDs that are not in `pending` status and return a summary of dismissed vs skipped counts.
6. WHEN bulk dismiss completes, THE Admin_UI SHALL remove the dismissed groups from the queue view and display a notification with the count.

### Requirement 10: Canonical Name Grouping

**User Story:** As an admin, I want listings grouped by their canonical name rather than their exact scraped name, so that "DeepCool AK400 Noir" and "DeepCool AK400 Blanc" appear as one group and I handle them together.

#### Acceptance Criteria

1. THE Unmatched_Queue SHALL display listings grouped by `canonical_name` from the Suggestion_Cache, not by raw `scraped_name`.
2. WHEN multiple listings share the same `canonical_name`, THE Admin_UI SHALL show the group as a single row with: the canonical name, the brand, the suggested category badge, the count of retailers, and the price range.
3. WHEN a group row is expanded, THE Admin_UI SHALL show each individual listing (retailer name, exact scraped name, price, URL, date scraped).
4. THE System SHALL expose a `GET /api/unmatched/grouped` endpoint that returns pending listings aggregated by `canonical_name` from `unmatched_suggestions`, sorted by descending group size.
5. WHEN a listing has no entry in `unmatched_suggestions` (job not yet run), THE System SHALL group it under its raw `scraped_name` as a fallback and display a "Pending analysis" badge.
6. THE grouped endpoint SHALL support the same `search` and `retailer_id` filter parameters as the existing `GET /api/unmatched` endpoint.

### Requirement 11: Suggestion Badges on Queue Rows

**User Story:** As an admin scanning the queue, I want to see a category and confidence badge on each group row without opening it, so that I can quickly identify what needs attention.

#### Acceptance Criteria

1. WHEN the Unmatched_Queue page loads, THE Admin_UI SHALL display a category badge and confidence indicator on each group row, sourced from the Suggestion_Cache.
2. WHEN `confidence = "high"`, THE badge SHALL use a green/filled style.
3. WHEN `confidence = "medium"`, THE badge SHALL use a yellow/outlined style.
4. WHEN `confidence = "low"` or no suggestion exists, THE badge SHALL display "Unknown" in a muted style.
5. THE Admin_UI SHALL NOT make per-row API calls for suggestions — all suggestion data SHALL be included in the `GET /api/unmatched/grouped` response.

### Requirement 12: On-Demand Re-Scrape After Linking

**User Story:** As an admin who just linked a component, I want to trigger a price fetch for that component immediately, so that I don't have to wait 24 hours for the next scheduled scrape to see prices.

#### Acceptance Criteria

1. WHEN a Create_And_Link or "Link to existing" operation succeeds, THE Admin_UI SHALL display a "Fetch prices now" button in the success toast alongside the dismiss action.
2. WHEN the admin clicks "Fetch prices now", THE System SHALL enqueue a targeted scrape for the URLs that were just mapped, using the existing scraper infrastructure.
3. THE System SHALL expose a `POST /api/scrapers/scrape-urls` endpoint (admin-only) that accepts an array of `{ retailer_id, product_url }` objects and triggers immediate scraping for those specific URLs.
4. THE targeted scrape SHALL reuse the existing scraper classes (nextlevelScraper, setupgameScraper, ultrapcScraper) without modification — only the entry point changes.
5. WHEN the targeted scrape completes, THE System SHALL run the aggregator for the fetched prices, updating the `prices` table immediately.

### Requirement 13: Data Integrity — No Duplicate Catalog Entries

**User Story:** As an admin, I want the system to prevent accidental duplicate components, so that price data is never fragmented across two entries for the same product.

#### Acceptance Criteria

1. WHEN the Create_And_Link form is submitted, THE System SHALL check for existing components with the same `canonical_name` and `category` before inserting.
2. IF an exact `canonical_name` + `category` + `brand` match is found, THE System SHALL return HTTP 409 identifying the conflicting component and SHALL NOT create a duplicate.
3. IF a near-match (same `canonical_name` and `category`, different `brand`) is found, THE System SHALL warn the admin in the UI but allow the save after explicit confirmation.
4. THE `components` table's existing `slug` UNIQUE constraint SHALL serve as the final database-level guard against duplicates.
5. THE Suggestion_Engine's `existing_match` field (Requirement 1, criteria 3–4) is the primary mechanism for preventing duplicates — the admin sees the existing component before deciding to create a new one.

### Requirement 14: Data Integrity — No Wrong-Category Mappings

**User Story:** As a platform user, I want every component in the catalog to be in the correct category, so that compatibility checks and price comparisons are accurate.

#### Acceptance Criteria

1. WHEN an admin overrides a `confidence: "high"` category suggestion, THE Admin_UI SHALL require an explicit confirmation step before saving.
2. THE System SHALL record the admin's identity, the original suggestion, and the override value in the `admin_activity_log` table whenever a category override is confirmed.
3. FOR ALL components in the catalog, the `category` field SHALL match one of the valid values in the `components_category_check` DB constraint; the database SHALL reject any INSERT or UPDATE that violates this constraint.
4. THE Suggestion_Engine SHALL never suggest a category for a scraped name when the DNA matcher has matched it to an existing component in a different category with `confidence: "high"` — the existing component's category takes precedence.

### Requirement 15: Backward Compatibility — No Regressions

**User Story:** As a developer, I want every new change to be strictly additive, so that existing scrapers, auto-mapper, compatibility engine, API routes, and frontend pages continue to work exactly as before.

#### Acceptance Criteria

1. ALL existing database migrations (001–022) SHALL remain unmodified; new schema changes SHALL be introduced only via migrations numbered 023 and above.
2. THE new `fan` and `thermal_paste` categories SHALL be added via `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT` — existing rows SHALL NOT be affected.
3. ALL existing API routes SHALL continue to respond with the same request/response shapes; no existing route handler SHALL be modified to accommodate this feature.
4. THE existing `GET /api/unmatched` endpoint SHALL remain unchanged and fully functional; the new grouped endpoint is additive.
5. THE existing `autoMapper.ts` `autoMap()` function signature and return type SHALL NOT change; the Pre_Processing_Job is a separate code path that calls the Suggestion_Engine independently.
6. THE existing `compatibilityService.ts` SHALL NOT require changes; `fan` and `thermal_paste` are non-participating categories with no compatibility rules.
7. ALL existing tests (578 backend + 28 frontend) SHALL pass after every implementation task; no task is complete if it introduces a test regression.
8. THE existing admin UI pages (Dashboard, Components, Retailers, Presets, Scrapers, Login, existing Unmatched behavior) SHALL remain fully functional.
9. ALL new API endpoints SHALL be protected by the existing `authMiddleware`; no new endpoint is accessible without a valid JWT.
10. THE `scraper_mappings` and `unmatched_listings` table structures SHALL NOT be altered; the new `unmatched_suggestions` table is additive.
