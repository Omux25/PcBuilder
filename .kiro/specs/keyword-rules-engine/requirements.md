# Requirements Document

## Introduction

The Keyword Rules Engine extends the existing Smart Catalog Expansion Engine with admin-configurable keyword→category mappings. Currently the suggestion engine's keyword sets are hardcoded in `suggestionEngine.ts` — admins cannot add, remove, or inspect them without a code deployment. With 778 low-confidence listings (no category detected) and 1,179 medium-confidence listings in the queue, admins need a way to teach the engine new patterns without touching source code.

This feature introduces five coordinated improvements:

1. **Engine fixes** — immediate correctness patches: AIO radiator size pattern (`240ml`, `360ml`), `fan` and `thermal_paste` auto-creation in `catalogBuilder.ts`, and HTML entity cleanup in component name output.
2. **Keyword Rules DB + Backend** — a `keyword_rules` table storing admin-defined keyword→category mappings, loaded at runtime by the suggestion engine before the hardcoded sets.
3. **Token Picker in Create & Link Modal** — the scraped name is tokenized into clickable chips inside the existing modal; clicking a token creates a keyword rule inline.
4. **Keyword Rules Admin Page** — a dedicated `/admin/keyword-rules` page for viewing, searching, and managing all rules (admin-created and built-in).
5. **catalogBuilder improvements** — extend `buildFromUnmatched` to auto-create `fan` and `thermal_paste` components, and update `inferCategory` to return those categories.

---

## Glossary

- **Keyword_Rule**: A row in the `keyword_rules` table mapping a keyword string to a component category. Has a `source` of either `admin` (user-created, deletable) or `builtin` (read-only, derived from hardcoded sets for transparency).
- **Admin_Rule**: A `Keyword_Rule` with `source = 'admin'`, created by an authenticated admin. Takes priority over built-in rules when both match the same scraped name.
- **Builtin_Rule**: A `Keyword_Rule` with `source = 'builtin'`, representing the hardcoded keyword sets already in `suggestionEngine.ts`. Shown in the UI for transparency but cannot be deleted.
- **Match_Type**: How the keyword is matched against a scraped product name. One of four values: `contains` (keyword appears anywhere, case-insensitive), `word` (keyword appears as a whole word, using word boundaries), `starts_with` (product name starts with keyword), `number_before` (a number immediately precedes the keyword, e.g. `ML` with `number_before` matches `240ML`, `360ML`). Built-in rules always use `contains`. Admin rules can use any match type.
- **Rule_Priority**: Admin rules are checked before built-in rules. When an admin rule matches, the built-in keyword scorer is not consulted for that listing.
- **Match_Count**: The number of pending unmatched listings (status = 'pending') whose `scraped_name` matches the rule's keyword+match_type combination. Computed on demand, not stored.
- **Token**: A single whitespace-delimited word extracted from a scraped product name, displayed as a chip in the Token_Picker.
- **Noise_Token**: A token that carries no category signal — color words (Noir, Blanc, Black, White, Rouge, Red, Blue, Bleu, Silver, Argent, Gold, Or), packaging words (Kit, Bundle, Pack, Combo, OEM, Retail, Box, Edition, Version), and single-character tokens. Displayed greyed-out and non-clickable in the Token_Picker.
- **Meaningful_Token**: A token that is not a Noise_Token. Displayed as a clickable blue chip in the Token_Picker.
- **Token_Picker**: A UI component inside the Create & Link Modal that renders the scraped name as a row of Token chips, allowing admins to click a Meaningful_Token to create a Keyword_Rule for it.
- **Rule_Preview**: A count of pending unmatched listings that would be affected by a given keyword+match_type combination, returned by `POST /api/admin/keyword-rules/preview` before the rule is saved.
- **Suggestion_Engine**: The existing `suggestionEngine.ts` service. Extended to load Admin_Rules from the DB at the start of each preprocessing run and check them before the hardcoded keyword sets.
- **catalogBuilder**: The existing `catalogBuilder.ts` module. Extended to handle `fan` and `thermal_paste` categories using the existing `extractFanSpecs` and `extractThermalPasteSpecs` helpers.
- **inferCategory**: The existing function in `shared/component-utils.ts`. Extended to return `'fan'` and `'thermal_paste'` for matching product names.
- **Admin**: An authenticated user of the admin panel with a valid JWT, permitted to manage keyword rules.

---

## Requirements

### Requirement 1: Engine Fix — AIO Radiator Size Pattern via number_before Match Type

**User Story:** As an admin, I want to create a single rule "ML → cooling (number before)" that matches 240ML, 360ML, 280ML and any future radiator size, so that all AIO coolers using volume notation are categorized correctly without creating a separate rule for each size.

#### Acceptance Criteria

1. THE System SHALL support a `number_before` match type that matches a scraped name when a number (one or more digits) immediately precedes the keyword (case-insensitive, no space required between number and keyword). Example: keyword `ML` with `number_before` matches `240ML`, `360ML`, `280ML` but NOT `ML` alone, `HTML`, or `email`.
2. WHEN the Suggestion_Engine evaluates an admin rule with `match_type = 'number_before'` and keyword `ML`, it SHALL match any scraped name containing a token of the form `\d+ML` (case-insensitive).
3. THE `number_before` match is implemented internally as the regex `\d+` + keyword (escaped), wrapped in word boundaries — the admin never sees or writes regex.
4. THE existing hardcoded cooling keyword set SHALL retain `'240ml'` and `'360ml'` as fallback entries so the engine works correctly even before the admin creates the `number_before` rule.
5. WHEN the admin creates the rule `ML → cooling (number_before)`, the preview SHALL show all pending items containing `\d+ml` patterns and the match_count SHALL reflect that count.

### Requirement 2: Engine Fix — catalogBuilder fan and thermal_paste Support

**User Story:** As an admin, I want the catalog builder to automatically create `fan` and `thermal_paste` components from scraped listings, so that those categories are handled the same way as cpu, gpu, ram, and the other eight supported categories.

#### Acceptance Criteria

1. WHEN `buildFromUnmatched` processes a listing whose `inferCategory` result is `'fan'`, THE catalogBuilder SHALL extract fan specs using the existing `extractFanSpecs` logic and INSERT a new component with `category = 'fan'`, `size_mm`, `rgb`, and `pack_size` populated.
2. WHEN `buildFromUnmatched` processes a listing whose `inferCategory` result is `'thermal_paste'`, THE catalogBuilder SHALL extract thermal paste specs using the existing `extractThermalPasteSpecs` logic and INSERT a new component with `category = 'thermal_paste'`, `weight_grams`, and `paste_type` populated.
3. THE `buildFromUnmatched` function signature `(onProgress?: (done: number, total: number) => void): Promise<BuildResult>` SHALL NOT change.
4. WHEN a fan component is created by `buildFromUnmatched`, THE System SHALL insert a `scraper_mappings` row and update the listing's `status = 'linked'`, identical to the behavior for all other supported categories.
5. WHEN a thermal paste component is created by `buildFromUnmatched`, THE System SHALL insert a `scraper_mappings` row and update the listing's `status = 'linked'`, identical to the behavior for all other supported categories.

### Requirement 3: Engine Fix — inferCategory fan and thermal_paste

**User Story:** As a developer, I want `inferCategory` in `shared/component-utils.ts` to return `'fan'` and `'thermal_paste'` for matching product names, so that `catalogBuilder` can auto-create those components without any additional routing logic.

#### Acceptance Criteria

1. WHEN `inferCategory` is called with a name matching the fan pattern (contains `fan` or `ventilateur` without cooler/AIO context, or contains `120mm`/`140mm`/`200mm` in a standalone fan context), THE function SHALL return `'fan'`.
2. WHEN `inferCategory` is called with a name matching the thermal paste pattern (contains `thermal paste`, `pâte thermique`, `kryonaut`, `conductonaut`, `mx-4`, `mx-6`, `mx-7`, `carbonaut`, or `kryosheet`), THE function SHALL return `'thermal_paste'`.
3. THE existing `inferCategory` return values for all other categories (cpu, gpu, ram, storage, motherboard, psu, cooling, case) SHALL remain unchanged — no existing categorization behavior SHALL regress.
4. THE fan detection in `inferCategory` SHALL NOT match names that already match the `cooling` pattern (AIO coolers, ventirad CPU coolers) — the cooling check takes precedence.
5. THE thermal paste detection in `inferCategory` SHALL NOT match names that already match any other category.

### Requirement 4: Engine Fix — HTML Entity Cleanup in catalogBuilder Output

**User Story:** As an admin browsing the catalog, I want component names created by the catalog builder to be free of HTML entities, so that names like "Corsair RM850&#8211;X" do not appear in the catalog.

#### Acceptance Criteria

1. WHEN `buildFromUnmatched` constructs a component name for insertion, THE catalogBuilder SHALL apply `decodeHtml()` to the scraped name before passing it to `cleanName()` and `extractBrand()`.
2. THE `decodeHtml` call SHALL occur before any spec extraction, so that spec extractors also receive clean input.
3. THE existing `decodeHtml` function in `shared/component-utils.ts` SHALL be used without modification.
4. WHEN a scraped name contains no HTML entities, THE behavior of `buildFromUnmatched` SHALL be identical to the current behavior.

### Requirement 5: Keyword Rules — Database Schema

**User Story:** As a developer, I want a `keyword_rules` table that stores admin-defined and built-in keyword→category mappings with match type control, so that the suggestion engine can load them at runtime.

#### Acceptance Criteria

1. THE System SHALL create a `keyword_rules` table via a new migration numbered `024` or higher, with the following columns: `id` (serial primary key), `keyword` (varchar(200), not null), `match_type` (varchar(20), not null, default `'contains'`, CHECK IN (`'contains'`, `'word'`, `'starts_with'`, `'number_before'`)), `category` (varchar(50), not null), `source` (varchar(10), not null, CHECK IN (`'admin'`, `'builtin'`)), `created_by` (integer, nullable, references `admins.id` ON DELETE SET NULL), `created_at` (timestamptz, not null, default NOW()).
2. THE `keyword_rules` table SHALL have a UNIQUE constraint on `(keyword, category, match_type)` to prevent duplicate rules for the same keyword+category+match_type combination.
3. THE `keyword_rules` table SHALL have a CHECK constraint ensuring `category` is one of the ten valid values: `cpu`, `gpu`, `ram`, `motherboard`, `storage`, `psu`, `case`, `cooling`, `fan`, `thermal_paste`.
4. THE migration SHALL NOT modify any existing migration files (001–023).
5. THE migration SHALL create an index on `(source)` and an index on `(keyword)` for efficient filtering and lookup.

### Requirement 6: Keyword Rules — Built-in Rule Seeding

**User Story:** As an admin, I want to see the existing hardcoded keyword sets displayed as built-in rules in the admin UI, so that I understand what the engine already knows and can identify gaps.

#### Acceptance Criteria

1. WHEN the migration for `keyword_rules` runs, THE System SHALL seed the table with one row per keyword from the existing `KEYWORD_SETS` in `suggestionEngine.ts`, with `source = 'builtin'` and `created_by = NULL`.
2. THE seeded built-in rules SHALL cover all ten categories: `cpu`, `gpu`, `ram`, `motherboard`, `storage`, `psu`, `case`, `cooling`, `fan`, `thermal_paste`.
3. THE built-in rules SHALL be idempotent — re-running the migration or seed SHALL NOT create duplicate rows (use `ON CONFLICT (keyword, category) DO NOTHING`).
4. THE hardcoded `KEYWORD_SETS` in `suggestionEngine.ts` SHALL remain as the fallback — the DB built-in rules are for display and admin awareness only; the engine uses the hardcoded sets as its final fallback.

### Requirement 7: Keyword Rules — Suggestion Engine Integration

**User Story:** As an admin, I want keyword rules I create to immediately affect how the suggestion engine categorizes pending listings, so that my rules take effect on the next preprocessing run without a code deployment.

#### Acceptance Criteria

1. WHEN `runSuggestionPreprocessing` starts a batch run, THE Suggestion_Engine SHALL load all `source = 'admin'` keyword rules from the `keyword_rules` table once, before processing any listings.
2. WHEN scoring a scraped name, THE Suggestion_Engine SHALL check admin rules BEFORE the hardcoded keyword sets — if any admin rule's keyword is found (case-insensitive substring match) in the scraped name, that rule's category SHALL be used with `confidence: "medium"`.
3. WHEN multiple admin rules match the same scraped name and they all agree on the same category, THE Suggestion_Engine SHALL use that category with `confidence: "medium"`.
4. WHEN multiple admin rules match the same scraped name but disagree on category, THE Suggestion_Engine SHALL fall through to the hardcoded keyword scorer as if no admin rule matched.
5. WHEN no admin rule matches, THE Suggestion_Engine SHALL proceed with the existing hardcoded keyword scorer behavior unchanged.
6. THE admin rule check SHALL only apply after the DNA matcher steps (perfect and partial threshold) — DNA matches always take precedence over keyword rules.
7. THE admin rules SHALL be loaded once per batch run, not once per listing — the same snapshot SHALL be used for all listings in a single `runSuggestionPreprocessing` call.

### Requirement 8: Keyword Rules — API Endpoints

**User Story:** As an admin, I want REST API endpoints to list, create, delete, and preview keyword rules, so that the admin UI and any future tooling can manage rules programmatically.

#### Acceptance Criteria

1. THE System SHALL expose `GET /api/admin/keyword-rules` returning all rules (both `admin` and `builtin`) as a JSON array, each row including: `id`, `keyword`, `match_type`, `category`, `source`, `created_by`, `created_at`, `match_count`. All rules are returned without pagination (the total count is expected to remain under 1,000).
2. THE System SHALL expose `POST /api/admin/keyword-rules` accepting `{ keyword: string, match_type: 'contains' | 'word' | 'starts_with' | 'number_before', category: string }` in the request body, creating a new rule with `source = 'admin'` and `created_by` set to the authenticated admin's ID. THE endpoint SHALL return the created rule as HTTP 201.
3. WHEN `POST /api/admin/keyword-rules` is called with a `keyword`+`category`+`match_type` combination that already exists, THE System SHALL return HTTP 409 with error code `DUPLICATE_RULE`.
4. WHEN `POST /api/admin/keyword-rules` is called with a `category` not in the valid set of ten categories, THE System SHALL return HTTP 400 with error code `INVALID_CATEGORY`.
5. WHEN `POST /api/admin/keyword-rules` is called with a `keyword` that is empty or exceeds 200 characters, THE System SHALL return HTTP 400 with error code `INVALID_KEYWORD`.
6. WHEN `POST /api/admin/keyword-rules` is called with a `match_type` not in `['contains', 'word', 'starts_with', 'number_before']`, THE System SHALL return HTTP 400 with error code `INVALID_MATCH_TYPE`.
7. THE System SHALL expose `DELETE /api/admin/keyword-rules/:id` that deletes the rule with the given ID. IF the rule has `source = 'builtin'`, THE System SHALL return HTTP 403 with error code `CANNOT_DELETE_BUILTIN`.
8. WHEN `DELETE /api/admin/keyword-rules/:id` is called for a non-existent ID, THE System SHALL return HTTP 404.
9. THE System SHALL expose `POST /api/admin/keyword-rules/preview` accepting `{ keyword: string, match_type: 'contains' | 'word' | 'starts_with' | 'number_before' }` and returning `{ match_count: number, sample_names: string[] }` where `match_count` is the number of pending unmatched listings whose `scraped_name` matches the keyword+match_type combination, and `sample_names` is up to 5 example scraped names.
10. ALL endpoints SHALL be protected by the existing `authMiddleware` — unauthenticated requests SHALL return HTTP 401.
11. AFTER a successful `POST` or `DELETE` on keyword rules, THE System SHALL trigger `runSuggestionPreprocessing` as a fire-and-forget background task.

### Requirement 9: Keyword Rules — match_count Field

**User Story:** As an admin viewing the rules list, I want to see how many pending listings each rule currently affects, so that I can prioritize which rules have the most impact.

#### Acceptance Criteria

1. WHEN `GET /api/admin/keyword-rules` is called, THE System SHALL include a `match_count` field on each rule in the response, computed as the count of `unmatched_listings` rows with `status = 'pending'` whose `scraped_name` ILIKE `'%' || keyword || '%'`.
2. THE `match_count` SHALL be computed in a single SQL query using a lateral join or subquery — not N+1 queries.
3. THE `match_count` is a live count at request time, not a stored value — it reflects the current state of the pending queue.
4. WHEN there are no pending listings matching a rule's keyword, THE `match_count` SHALL be `0`.

### Requirement 10: Token Picker — Tokenization

**User Story:** As an admin opening a low-confidence group in the Create & Link Modal, I want to see the scraped name broken into clickable tokens, so that I can quickly identify which word should become a keyword rule.

#### Acceptance Criteria

1. WHEN the Create & Link Modal opens for a group with `confidence: "low"`, THE Token_Picker SHALL be displayed above the form fields, showing the scraped name of the first listing in the group tokenized into individual word chips.
2. THE Token_Picker SHALL classify each token as either a Noise_Token or a Meaningful_Token using the same token lists as `deriveCanonicalName` (COLOR_TOKENS + NOISE_TOKENS) plus single-character tokens.
3. Noise_Tokens SHALL be rendered as greyed-out, non-interactive chips (cursor: default, reduced opacity).
4. Meaningful_Tokens SHALL be rendered as blue, clickable chips (cursor: pointer, accent color).
5. THE Token_Picker SHALL also be displayed for groups with `confidence: "medium"` — it is hidden only for `confidence: "high"` groups where the match is already certain.
6. THE Token_Picker SHALL be a new React component `TokenPicker.tsx` in `apps/admin/src/components/`.

### Requirement 11: Token Picker — Inline Rule Creation

**User Story:** As an admin, I want to click a token chip, choose a match type and category, preview the impact, and save a rule — all without leaving the modal.

#### Acceptance Criteria

1. WHEN an admin clicks a Meaningful_Token chip, THE Token_Picker SHALL display an inline panel below that chip containing: the token text (read-only), a match type selector (radio buttons: "Exact word", "Anywhere in name", "Name starts with", "Number before"), a category dropdown (all ten valid categories using `CATEGORY_LABELS`), a "Preview" button, and a "Save rule" button (disabled until preview has been run).
2. THE match type radio buttons SHALL use plain language labels — the admin never sees the internal values `word`, `contains`, `starts_with`, `number_before`.
3. WHEN the admin clicks "Preview", THE Token_Picker SHALL call `POST /api/admin/keyword-rules/preview` with the token as keyword and the selected match_type, then display inline: "This rule would affect X pending items" with up to 3 sample names shown.
4. THE "Save rule" button SHALL only become enabled after a successful preview has been run.
5. WHEN the admin clicks "Save rule", THE Token_Picker SHALL call `POST /api/admin/keyword-rules` to create the rule, then close the inline panel.
6. WHEN the rule is saved successfully, THE Create & Link Modal SHALL trigger a re-process of the current group and update the displayed category badge and pre-filled form fields.
7. WHEN the rule creation fails (e.g., duplicate), THE Token_Picker SHALL display the error message inline without closing the modal.
8. WHEN a token already has an existing admin rule for any category, THE chip SHALL display a small dot indicator to signal that a rule already exists for that token.
9. Only one inline panel SHALL be open at a time — clicking a second token SHALL close the first panel.

### Requirement 12: Keyword Rules Admin Page — Route and Layout

**User Story:** As an admin, I want a dedicated page at `/admin/keyword-rules` to manage all keyword rules, so that I have a central place to audit and maintain the engine's vocabulary.

#### Acceptance Criteria

1. THE Admin_UI SHALL add a new route `/admin/keyword-rules` rendering a `KeywordRules` page component in `apps/admin/src/pages/KeywordRules.tsx`.
2. THE route SHALL be added to the existing `App.tsx` router alongside the other admin routes.
3. THE page SHALL be linked from the existing admin navigation layout (`Layout.tsx`) with the label "Keyword Rules" and an appropriate icon.
4. THE page SHALL be protected — unauthenticated users SHALL be redirected to `/login`, consistent with all other admin pages.
5. THE page title SHALL be "Keyword Rules" and the subtitle SHALL show the total count of admin rules and built-in rules separately (e.g., "12 admin rules · 87 built-in rules").

### Requirement 13: Keyword Rules Admin Page — Rules Table

**User Story:** As an admin, I want to see all keyword rules in a sortable, searchable table, so that I can quickly find and manage specific rules.

#### Acceptance Criteria

1. THE KeywordRules page SHALL display a table with columns: Keyword, Match Type, Category, Source (admin/built-in badge), Items Affected (match_count), Date Added, Actions.
2. Built-in rules SHALL display a "Built-in" badge (read-only style) in the Source column and SHALL NOT have a delete button in the Actions column.
3. Admin rules SHALL display an "Admin" badge in the Source column and SHALL have a delete button in the Actions column.
4. WHEN the admin clicks the delete button on an admin rule, THE Admin_UI SHALL show a confirmation dialog before calling `DELETE /api/admin/keyword-rules/:id`.
5. WHEN a rule is deleted, THE Admin_UI SHALL remove it from the table and display a success toast.
6. THE table SHALL support a search/filter bar that filters rows client-side by keyword substring and by category (dropdown filter).
7. THE table SHALL be sorted by `source` (admin rules first) then by `created_at` descending by default.

### Requirement 14: Keyword Rules Admin Page — Add Rule Form

**User Story:** As an admin, I want an "Add rule" button on the Keyword Rules page that opens a form with keyword, match type, and category, so that I can create new rules without going through the unmatched queue.

#### Acceptance Criteria

1. THE KeywordRules page SHALL display an "Add rule" button that opens a modal form with: a keyword text input, a match type selector (radio buttons: "Exact word", "Anywhere in name", "Name starts with", "Number before"), a category dropdown (all ten valid categories), and a "Preview" button.
2. WHEN the admin clicks "Preview", THE Admin_UI SHALL call `POST /api/admin/keyword-rules/preview` with the keyword and selected match_type, and display the result inline: "This rule would affect X pending items" with up to 5 sample names shown.
3. THE "Save" button SHALL only become enabled after a successful preview has been run, preventing blind rule creation.
4. WHEN the admin submits the form, THE Admin_UI SHALL call `POST /api/admin/keyword-rules` and add the new rule to the table on success.
5. WHEN the form submission returns HTTP 409 (duplicate), THE Admin_UI SHALL display "A rule for this keyword+match type+category already exists" without closing the form.
6. WHEN the form submission returns HTTP 400 (validation error), THE Admin_UI SHALL display the error message from the response.
7. THE keyword input SHALL be trimmed of leading/trailing whitespace before submission.
8. THE "Save" button SHALL be disabled until keyword, match_type, and category are all filled in AND a preview has been run.

### Requirement 15: catalogBuilder — Fan Component Auto-Creation

**User Story:** As an admin, I want the catalog builder to automatically create fan components from scraped listings, so that standalone case fans are catalogued without manual intervention.

#### Acceptance Criteria

1. WHEN `buildFromUnmatched` encounters a listing with `inferCategory` returning `'fan'`, THE catalogBuilder SHALL call a `extractFanSpecs` function to extract: `size_mm` (from patterns like `120mm`, `140mm`, `200mm`), `rgb` (boolean, from `rgb` or `argb` in the name), `pack_size` (integer, from `triple`/`3x`/`dual`/`twin`/`2x` patterns, defaulting to 1).
2. THE catalogBuilder SHALL INSERT the fan component with `category = 'fan'`, `size_mm`, `rgb`, and `pack_size` columns populated.
3. WHEN `size_mm` cannot be extracted from the name, THE catalogBuilder SHALL default to `120` (the most common fan size).
4. THE `extractFanSpecs` function SHALL be added to `shared/component-utils.ts` alongside the existing spec extractors.
5. THE fan component creation path SHALL follow the same DNA dedup check as all other categories — if a matching fan component already exists in the catalog, the listing SHALL be linked to it rather than creating a duplicate.

### Requirement 16: catalogBuilder — Thermal Paste Component Auto-Creation

**User Story:** As an admin, I want the catalog builder to automatically create thermal paste components from scraped listings, so that thermal interface materials are catalogued without manual intervention.

#### Acceptance Criteria

1. WHEN `buildFromUnmatched` encounters a listing with `inferCategory` returning `'thermal_paste'`, THE catalogBuilder SHALL call a `extractThermalPasteSpecs` function to extract: `weight_grams` (from patterns like `4g`, `8g`, `1 gramme`, `4 grammes`), `paste_type` (from `conductonaut`/`liquid metal` → `liquid_metal`, `carbonaut`/`kryosheet`/`pad` → `pad`, default → `paste`).
2. THE catalogBuilder SHALL INSERT the thermal paste component with `category = 'thermal_paste'`, `weight_grams`, and `paste_type` columns populated.
3. WHEN `weight_grams` cannot be extracted from the name, THE catalogBuilder SHALL insert `NULL` for `weight_grams`.
4. THE `extractThermalPasteSpecs` function SHALL be added to `shared/component-utils.ts` alongside the existing spec extractors.
5. THE thermal paste component creation path SHALL follow the same DNA dedup check as all other categories.

### Requirement 17: Data Integrity — Rule Deletion Does Not Affect Existing Mappings

**User Story:** As an admin, I want deleting a keyword rule to have no effect on components or scraper mappings that were already created, so that historical data is never corrupted by rule changes.

#### Acceptance Criteria

1. WHEN an admin rule is deleted, THE System SHALL only delete the row from `keyword_rules` — no `scraper_mappings`, `components`, or `unmatched_listings` rows SHALL be modified.
2. THE `keyword_rules` table SHALL have no foreign key relationships to `scraper_mappings`, `components`, or `unmatched_listings`.
3. WHEN an admin rule is deleted and `runSuggestionPreprocessing` subsequently runs, THE Suggestion_Engine SHALL re-evaluate pending listings without that rule — previously linked listings (status = 'linked') are unaffected.
4. THE `unmatched_suggestions` cache rows for already-linked listings SHALL NOT be re-evaluated after a rule deletion — only `status = 'pending'` listings are reprocessed.

### Requirement 18: Data Integrity — Built-in Rules Are Immutable

**User Story:** As an admin, I want built-in rules to always be present and unmodifiable, so that the engine's baseline vocabulary cannot be accidentally destroyed.

#### Acceptance Criteria

1. THE System SHALL enforce at the API layer that `DELETE /api/admin/keyword-rules/:id` returns HTTP 403 when the target rule has `source = 'builtin'`.
2. THE System SHALL enforce at the API layer that `POST /api/admin/keyword-rules` cannot create a rule with `source = 'builtin'` — the `source` field is always set to `'admin'` by the server, regardless of what the client sends.
3. WHEN the `keyword_rules` table is queried, built-in rules SHALL always be present — the migration seed is the authoritative source and is idempotent.
4. THE Admin_UI SHALL not render a delete button for built-in rules, providing a second layer of protection.

### Requirement 19: Data Integrity — Admin Rule Priority

**User Story:** As an admin, I want my custom rules to take priority over built-in rules, so that I can override incorrect built-in categorizations for specific keywords.

#### Acceptance Criteria

1. WHEN both an admin rule and a built-in keyword set entry match the same scraped name, THE Suggestion_Engine SHALL use the admin rule's category.
2. WHEN an admin rule matches a scraped name, THE Suggestion_Engine SHALL NOT consult the built-in keyword scorer for that listing's category determination.
3. THE DNA matcher steps (perfect and partial threshold) SHALL always take precedence over both admin rules and built-in keyword sets — admin rules only affect the keyword scoring phase.
4. THE built-in keyword sets in `suggestionEngine.ts` SHALL remain in the source code as the final fallback — they are not replaced by the DB built-in rules.

### Requirement 20: Backward Compatibility — No Regressions

**User Story:** As a developer, I want all existing functionality to continue working after this feature is implemented, so that the 655 passing backend tests and all frontend behavior remain intact.

#### Acceptance Criteria

1. ALL existing database migrations (001–023) SHALL remain unmodified; new schema changes SHALL be introduced only via migration 024 or higher.
2. THE `buildFromUnmatched` function signature SHALL NOT change — it remains `(onProgress?: (done: number, total: number) => void): Promise<BuildResult>`.
3. ALL existing API routes SHALL continue to respond with the same request/response shapes — no existing route handler SHALL be modified to accommodate this feature.
4. THE existing `GET /api/admin/unmatched-listings/grouped` endpoint SHALL remain unchanged — the Token_Picker is a frontend-only addition to the existing Create & Link Modal.
5. THE existing `suggestionEngine.ts` keyword scorer behavior SHALL be preserved as a fallback — admin rules are checked first, but if none match, the hardcoded sets are used exactly as before.
6. ALL 655 existing backend tests SHALL pass after every implementation task; no task is complete if it introduces a test regression.
7. THE existing admin UI pages (Dashboard, Components, Retailers, Presets, Scrapers, Unmatched) SHALL remain fully functional.
8. ALL new API endpoints SHALL be protected by the existing `authMiddleware`.
9. THE `inferCategory` changes (Requirement 3) SHALL be validated against the existing `catalogBuilder.test.ts` test suite — no existing test SHALL fail.

---

## Correctness Properties

### Property 1: Admin Rule Priority Is Absolute (Keyword Phase)
For any scraped name N and any admin rule R where `R.keyword` is a case-insensitive substring of N: `suggestForListing(N, catalog, adminRules)` SHALL return `category = R.category` when no DNA match exists, regardless of what the hardcoded keyword scorer would return.

### Property 2: Rule Deletion Does Not Corrupt Linked Data
For any `scraper_mappings` row M created before a keyword rule deletion: after deleting any keyword rule, M SHALL still exist with the same `component_id` and `product_url`. The deletion of a keyword rule is a pure `keyword_rules` table operation.

### Property 3: Built-in Rules Are Always Present
After any sequence of admin rule create/delete operations, the count of rows in `keyword_rules` with `source = 'builtin'` SHALL equal the count of keywords in the hardcoded `KEYWORD_SETS` (one row per keyword per category).

### Property 4: Token Picker Only Surfaces Meaningful Tokens
For any scraped name N tokenized by the Token_Picker: every token T classified as Meaningful SHALL NOT appear in the COLOR_TOKENS or NOISE_TOKENS lists, and SHALL have length > 1.

### Property 5: inferCategory Fan/Thermal Paste Does Not Regress Cooling
For any scraped name N that `inferCategory` currently returns `'cooling'`: after the Requirement 3 changes, `inferCategory(N)` SHALL still return `'cooling'`. The fan and thermal_paste detection paths SHALL only fire for names that currently return `null`.

### Property 6: Preview Count Matches Actual Affected Listings
For any keyword K: the `match_count` returned by `POST /api/admin/keyword-rules/preview` with `{ keyword: K }` SHALL equal the count of rows in `unmatched_listings` with `status = 'pending'` and `scraped_name ILIKE '%' || K || '%'` at the time of the request.
