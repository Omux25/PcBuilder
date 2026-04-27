# Task 10.5 — Scheduler (`scraper/scheduler.ts`)

## What was built

The scheduler wires together all scraping components and runs the full session every 24 hours using `Bun.cron()`.

---

## Files created

- `backend/scraper/scheduler.ts` — the scheduler
- `backend/scraper/__tests__/scheduler.test.ts` — 9 unit tests

---

## How it works

```
Bun.cron('0 0 * * *', runScrapingSession)
  → logger.info('Scraping session started')
  → site1.scrapeListingPage()   ← try/catch
  → site2.scrapeAllProducts()   ← try/catch
  → aggregate(allPrices)
  → logger.info('Session complete: X updated, Y errors')
```

Each scraper runs inside its own `try/catch`. If one fails, the error is logged and the next scraper runs — one broken site never stops the session.

### Cron expression

```
0 0 * * *   →   every day at midnight
```

`Bun.cron()` is built into Bun 1.3+ — no external package needed.

### `runScrapingSession()` is exported

The session function is exported so it can be:
- Called directly in tests (without waiting for midnight)
- Triggered manually for debugging: `bun -e "import('./scraper/scheduler.js').then(m => m.runScrapingSession())"`

---

## How to start the scheduler

The scheduler starts automatically when the file is imported. Add this to `server.ts` to run it alongside the API:

```typescript
import '../scraper/scheduler.js';
```

Or run it standalone (no HTTP server):

```bash
bun scraper/scheduler.ts
```

---

## Backend complete

The entire backend is now done:

| Layer | Status |
|---|---|
| DB migrations | ✅ |
| Zod schemas + validation middleware | ✅ |
| JWT auth middleware + login route | ✅ |
| Component service (data access) | ✅ |
| Public API routes | ✅ |
| Admin API routes | ✅ |
| App wiring (app.ts + server.ts) | ✅ |
| Scraping system (logger, scrapers, aggregator, scheduler) | ✅ |

164 tests, 0 failures.

Next: Phase 6 — React frontend.
