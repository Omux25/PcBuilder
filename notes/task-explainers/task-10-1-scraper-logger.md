# Task 10.1 — Structured Logger (`scraper/utils/logger.ts`)

## What was built

A thin logger that writes scraper events to the `scraper_logs` table with three severity levels.

---

## Files created

- `backend/scraper/utils/logger.ts` — the logger
- `backend/scraper/utils/__tests__/logger.test.ts` — 9 unit tests
- `backend/scraper/utils/__tests__/tsconfig.json` — test tsconfig for the scraper directory

---

## API

```typescript
import { logger } from './logger.js';

await logger.info('Scraping session started');
await logger.info('Fetched 12 products', 'site1.ma');   // with site
await logger.warn('HTML structure changed', 'site2.ma');
await logger.error('Failed to fetch product page', 'site1.ma');
```

Each method maps to a log level in the `scraper_logs` table:

| Method | Level | When to use |
|---|---|---|
| `logger.info` | `INFO` | Normal operation — session started, session complete |
| `logger.warn` | `WARNING` | Something unusual but not critical — HTML structure changed |
| `logger.error` | `ERROR` | A scraper failed for a specific site |

The `site` parameter is optional. When omitted, the `site` column is stored as `NULL`.

---

## Key design decision — resilience

The logger wraps every DB insert in a `try/catch`. If the insert fails (DB down, connection error, etc.), the error is printed to `stderr` and the function returns normally:

```typescript
async function log(level, message, site) {
  try {
    await _sql`INSERT INTO scraper_logs ...`;
  } catch (err) {
    console.error(`[logger] Failed to write log entry ...`, err);
    // returns undefined — does NOT rethrow
  }
}
```

This is intentional: **a logging failure must never crash the scraper**. The scraper's job is to fetch prices — if it can't log, it should keep going.

---

## Dependency injection

Same pattern as `componentService.ts`. The logger exports `setSql()` and `resetSql()` so tests can inject a mock without touching the real database:

```typescript
import { logger, setSql, resetSql } from '../logger.js';

setSql((strings, ...values) => {
  // capture values[0]=level, values[1]=site, values[2]=message
  return Promise.resolve([]);
});
```

---

## What's next

Task 10.2 — Abstract base scraper: a class that handles the common HTTP fetch + HTML parse logic, which site-specific scrapers will extend.
