# Bugfix Requirements Document

## Introduction

This document captures the requirements for a comprehensive codebase cleanup of the PC Builder Maroc project. A full audit identified 13 issues across four severity levels: critical dead code and broken infrastructure (🔴), structural mismatches that silently break features (🟠), and code quality problems that cause incorrect runtime behavior or mislead developers (🟡). Each issue is treated as a discrete bug with a clear condition, defective behavior, and expected correct behavior.

---

## Bug Analysis

### Current Behavior (Defect)

**Issue 1 — Dead route file: `smartSearch.ts`**

1.1 WHEN `backend/src/routes/smartSearch.ts` exists in the codebase THEN the system exports `smartSearchRouter` that is never imported or mounted in `app.ts`, making the file unreachable dead code that duplicates the already-mounted smart search endpoint in `components.ts`

**Issue 2 — Dead route file: `prices.ts`**

1.2 WHEN `backend/src/routes/prices.ts` exists in the codebase THEN the system exports `pricesRouter` that is never imported or mounted in `app.ts`, making the file unreachable dead code that duplicates the already-mounted `GET /api/components/:id/prices` endpoint in `components.ts`

**Issue 3 — Duplicate migration number 015**

1.3 WHEN the migration runner processes `backend/src/db/migrations/` THEN the system encounters two files sharing the number `015` (`015_add_benchmark_score.sql` and `015_fix_ram_types_encoding.sql`), causing any migration runner that tracks applied migrations by number to either skip one migration silently or fail with a conflict error

**Issue 4 — `admin/unmatched.ts` and `admin/logs.ts` bypass the DI layer**

1.4 WHEN `backend/src/routes/admin/unmatched.ts` or `backend/src/routes/admin/logs.ts` execute a database query THEN the system uses `import { sql } from 'bun'` directly instead of `getSql()` from `backend/src/db/index.ts`, making these routes impossible to test with a mocked SQL connection and inconsistent with every other route in the codebase

**Issue 5 — Scraper registry IDs don't match actual retailer IDs**

1.5 WHEN `POST /api/admin/scrapers/:retailerId/run` is called with a real retailer ID (10, 11, or 13) THEN the system passes that ID to `runScrapingSession(retailerId)` which filters `SCRAPER_REGISTRY` by `id`, but the registry maps UltraPC→id:1, NextLevel→id:2, SetupGame→id:3 instead of the actual database IDs 10, 11, 13 — so no scraper is found and the targeted scrape silently does nothing

**Issue 6 — `temp_migrate.ts` left in production source tree**

1.6 WHEN `backend/src/db/temp_migrate.ts` exists in the repository THEN the system contains a one-off throwaway script with hardcoded credentials (`postgres:postgres@127.0.0.1:5433`) committed to the production source tree, posing a security and maintenance risk

**Issue 7 — `GEMINI.md` stale tooling config at project root**

1.7 WHEN `GEMINI.md` exists at the project root THEN the system contains a stale configuration file for the Gemini CLI tool that is not part of project documentation and does not belong in the repository

**Issue 8 — Empty `scratch/` directory committed**

1.8 WHEN the `scratch/` directory exists at the project root THEN the system contains an empty directory with no content that was committed to Git, adding noise to the repository structure

**Issue 9 — `notes/diagrams/rendered2/` committed to Git**

1.9 WHEN `notes/diagrams/rendered2/` exists in the repository THEN the system contains 7 duplicate rendered PNG diagram files that should be gitignored (the `.gitignore` excludes `rendered/` but not `rendered2/`), causing generated binary artifacts to be tracked in Git

**Issue 10 — Broken transaction in bulk import**

1.10 WHEN `POST /api/admin/components/import` is called THEN the system wraps the import loop in `sql.begin()` but calls `createComponent()` which internally calls `getSql()` — the global connection, not the transaction object — so the `_tx` parameter passed to the callback is never used and no actual atomicity is provided; a failure mid-import leaves the database in a partially-imported state

**Issue 11 — Missing `RULE_LABELS` and `RULE_TOOLTIPS` entries**

1.11 WHEN the frontend renders a compatibility error with rule `form_factor_mismatch` or `cooler_too_tall` THEN the system looks up `RULE_LABELS[rule]` and `RULE_TOOLTIPS[rule]` in `frontend/src/types.ts` but finds `undefined` because those two rules are missing from both maps, causing the UI to display blank or broken labels for those compatibility errors

**Issue 12 — Docs reference non-existent scripts**

1.12 WHEN a developer reads `notes/features/scraping-system.md` and attempts to run the listed operational scripts THEN the system does not contain `remap_all.ts`, `shadow_run_matcher.ts`, `evaluate_matcher.ts`, `auto_map_ultrapc.ts`, `auto_map_nextlevel.ts`, `auto_map_setupgame.ts`, or `time_scrapers.ts` in `backend/scripts/tools/`, making the documentation actively misleading

**Issue 13 — API docs say GET, endpoint is POST**

1.13 WHEN a developer reads `notes/reference/api.md` for the smart search endpoint THEN the system documents it as `GET /api/components/smart-search` but the actual endpoint registered in `components.ts` is `POST /api/components/smart-search`, causing any client or developer following the docs to send the wrong HTTP method and receive a 404

---

### Expected Behavior (Correct)

**Issue 1 — Dead route file: `smartSearch.ts`**

2.1 WHEN the codebase is audited for dead code THEN the system SHALL have `backend/src/routes/smartSearch.ts` removed, with the canonical smart search implementation remaining only in `components.ts`

**Issue 2 — Dead route file: `prices.ts`**

2.2 WHEN the codebase is audited for dead code THEN the system SHALL have `backend/src/routes/prices.ts` removed, with the canonical prices implementation remaining only in `components.ts`

**Issue 3 — Duplicate migration number 015**

2.3 WHEN the migration runner processes `backend/src/db/migrations/` THEN the system SHALL have uniquely numbered migration files, with `015_fix_ram_types_encoding.sql` renumbered to `016` and all subsequent migrations renumbered accordingly so no two files share the same number

**Issue 4 — `admin/unmatched.ts` and `admin/logs.ts` bypass the DI layer**

2.4 WHEN `backend/src/routes/admin/unmatched.ts` or `backend/src/routes/admin/logs.ts` execute a database query THEN the system SHALL use `getSql()` from `backend/src/db/index.ts` for all SQL calls, consistent with every other route in the codebase and enabling test mocking

**Issue 5 — Scraper registry IDs don't match actual retailer IDs**

2.5 WHEN `POST /api/admin/scrapers/:retailerId/run` is called with retailer ID 10, 11, or 13 THEN the system SHALL find the correct scraper in `SCRAPER_REGISTRY` and execute it, because the registry IDs SHALL match the actual database retailer IDs (UltraPC→10, NextLevel→11, SetupGame→13)

**Issue 6 — `temp_migrate.ts` left in production source tree**

2.6 WHEN the repository is inspected THEN the system SHALL NOT contain `backend/src/db/temp_migrate.ts`, as the file SHALL be deleted from the source tree

**Issue 7 — `GEMINI.md` stale tooling config at project root**

2.7 WHEN the repository is inspected THEN the system SHALL NOT contain `GEMINI.md` at the project root, as the file SHALL be deleted

**Issue 8 — Empty `scratch/` directory committed**

2.8 WHEN the repository is inspected THEN the system SHALL NOT contain an empty `scratch/` directory, as it SHALL be removed from the repository

**Issue 9 — `notes/diagrams/rendered2/` committed to Git**

2.9 WHEN `notes/diagrams/rendered2/` is inspected THEN the system SHALL have this directory excluded by `.gitignore` (adding `notes/diagrams/rendered2/` to `.gitignore`) and the committed PNG files SHALL be removed from Git tracking

**Issue 10 — Broken transaction in bulk import**

2.10 WHEN `POST /api/admin/components/import` is called and a row fails mid-import THEN the system SHALL roll back all previously inserted rows in that import batch, because the transaction SHALL be passed through to `createComponent()` (either by refactoring `createComponent()` to accept an optional transaction parameter, or by inlining the insert logic inside the `sql.begin()` callback using the `_tx` connection)

**Issue 11 — Missing `RULE_LABELS` and `RULE_TOOLTIPS` entries**

2.11 WHEN the frontend renders a compatibility error with rule `form_factor_mismatch` or `cooler_too_tall` THEN the system SHALL display the correct French label and tooltip, because `RULE_LABELS` and `RULE_TOOLTIPS` in `frontend/src/types.ts` SHALL contain entries for both rules

**Issue 12 — Docs reference non-existent scripts**

2.12 WHEN a developer reads `notes/features/scraping-system.md` THEN the system SHALL list only scripts that actually exist in `backend/scripts/tools/`, with the non-existent scripts either removed from the docs or replaced with the correct filenames of scripts that do exist

**Issue 13 — API docs say GET, endpoint is POST**

2.13 WHEN a developer reads `notes/reference/api.md` for the smart search endpoint THEN the system SHALL document it as `POST /api/components/smart-search`, matching the actual HTTP method used by the route handler

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `GET /api/components/:id/prices` is called THEN the system SHALL CONTINUE TO return price offers for the component, served by the existing implementation in `components.ts`

3.2 WHEN `POST /api/components/smart-search` is called with valid parameters THEN the system SHALL CONTINUE TO return enriched components with compatibility and price data, served by the existing implementation in `components.ts`

3.3 WHEN `POST /api/admin/scrapers/run-all` is called THEN the system SHALL CONTINUE TO trigger a full scraping session across all active retailers

3.4 WHEN `POST /api/admin/scrapers/:retailerId/run` is called with a valid retailer ID that has no registered scraper THEN the system SHALL CONTINUE TO log a warning and return without error

3.5 WHEN `GET /api/admin/unmatched-listings` is called with a valid JWT THEN the system SHALL CONTINUE TO return the list of unmatched listings from the database

3.6 WHEN `GET /api/admin/logs` is called with a valid JWT THEN the system SHALL CONTINUE TO return scraper logs with optional level/site/limit filtering

3.7 WHEN `POST /api/admin/components/import` is called with a valid file containing no errors THEN the system SHALL CONTINUE TO import all rows successfully and return the correct imported/skipped/failed counts

3.8 WHEN the compatibility engine evaluates a build containing `socket_mismatch`, `ram_type_mismatch`, `ram_frequency_exceeded`, `gpu_too_long`, or `psu_underpowered` THEN the system SHALL CONTINUE TO return the correct errors and warnings for those rules

3.9 WHEN the migration runner is executed against a fresh database THEN the system SHALL CONTINUE TO apply all migrations in order without errors, with the renumbered migrations producing the same schema as before

3.10 WHEN any route other than `admin/unmatched.ts` and `admin/logs.ts` executes a database query THEN the system SHALL CONTINUE TO use `getSql()` from `backend/src/db/index.ts` unchanged

---

## Bug Condition Pseudocode

### Issues 1 & 2 — Dead route files

```pascal
FUNCTION isBugCondition_DeadRouteFile(file)
  INPUT: file path in backend/src/routes/
  OUTPUT: boolean
  RETURN file exports a router AND that router is NOT imported in app.ts
END FUNCTION

// Fix Checking
FOR ALL file WHERE isBugCondition_DeadRouteFile(file) DO
  ASSERT file does NOT exist in the repository
END FOR

// Preservation Checking
FOR ALL route WHERE NOT isBugCondition_DeadRouteFile(route) DO
  ASSERT F(route) = F'(route)  // all mounted routes still respond correctly
END FOR
```

### Issue 3 — Duplicate migration number

```pascal
FUNCTION isBugCondition_DuplicateMigration(migrations)
  INPUT: list of migration filenames
  OUTPUT: boolean
  RETURN EXISTS two files with the same numeric prefix
END FUNCTION

// Fix Checking
FOR ALL migrations WHERE isBugCondition_DuplicateMigration(migrations) DO
  result ← list migration numbers
  ASSERT all migration numbers are unique
END FOR
```

### Issue 4 — Direct `sql` import bypassing DI

```pascal
FUNCTION isBugCondition_DirectSqlImport(file)
  INPUT: source file path
  OUTPUT: boolean
  RETURN file contains "import { sql } from 'bun'" AND file is a route handler
END FUNCTION

// Fix Checking
FOR ALL file WHERE isBugCondition_DirectSqlImport(file) DO
  ASSERT file uses getSql() from db/index.ts instead
END FOR
```

### Issue 5 — Scraper registry ID mismatch

```pascal
FUNCTION isBugCondition_RegistryIdMismatch(retailerId)
  INPUT: retailerId from database (integer)
  OUTPUT: boolean
  RETURN retailerId IN {10, 11, 13} AND SCRAPER_REGISTRY has no entry with id = retailerId
END FUNCTION

// Fix Checking
FOR ALL retailerId WHERE isBugCondition_RegistryIdMismatch(retailerId) DO
  result ← runScrapingSession(retailerId)
  ASSERT scraper was found AND executed (not silently skipped)
END FOR
```

### Issue 10 — Broken transaction in bulk import

```pascal
FUNCTION isBugCondition_BrokenTransaction(importBatch)
  INPUT: array of component rows
  OUTPUT: boolean
  RETURN importBatch contains at least one valid row followed by at least one invalid row
END FUNCTION

// Fix Checking
FOR ALL importBatch WHERE isBugCondition_BrokenTransaction(importBatch) DO
  result ← POST /api/admin/components/import with importBatch
  ASSERT no rows from importBatch were persisted (full rollback)
END FOR
```

### Issue 11 — Missing RULE_LABELS / RULE_TOOLTIPS entries

```pascal
FUNCTION isBugCondition_MissingRuleLabel(rule)
  INPUT: rule string from compatibility error
  OUTPUT: boolean
  RETURN rule IN {'form_factor_mismatch', 'cooler_too_tall'}
         AND RULE_LABELS[rule] = undefined
END FUNCTION

// Fix Checking
FOR ALL rule WHERE isBugCondition_MissingRuleLabel(rule) DO
  ASSERT RULE_LABELS[rule] IS NOT undefined
  ASSERT RULE_TOOLTIPS[rule] IS NOT undefined
END FOR
```
