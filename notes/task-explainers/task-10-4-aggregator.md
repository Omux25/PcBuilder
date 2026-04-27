# Task 10.4 — Aggregator (`scraper/aggregator.ts`)

## What was built

A function that takes all `ScrapedPrice[]` results from every scraper and writes them to the `prices` table using UPSERT.

---

## Files created

- `backend/scraper/aggregator.ts` — the aggregator
- `backend/scraper/__tests__/aggregator.test.ts` — 9 unit tests
- `backend/scraper/__tests__/tsconfig.json` — test tsconfig

---

## API

```typescript
import { aggregate } from './aggregator.js';

const result = await aggregate(allPrices);
// result = { updated: 42, errors: 1 }
```

Returns `{ updated: number, errors: number }` — a summary of how many rows succeeded and how many failed.

---

## The UPSERT

```sql
INSERT INTO prices (component_id, retailer_id, price, in_stock, product_url, last_updated)
VALUES ($1, $2, $3, $4, $5, NOW())
ON CONFLICT (component_id, retailer_id)
DO UPDATE SET
  price        = EXCLUDED.price,
  in_stock     = EXCLUDED.in_stock,
  product_url  = EXCLUDED.product_url,
  last_updated = NOW()
```

The `UNIQUE (component_id, retailer_id)` constraint in the `prices` table is the conflict target. Each (component, retailer) pair has exactly one row — the scraper updates it in place rather than inserting duplicates.

---

## Error handling

Each row is processed in its own `try/catch`. If one UPSERT fails (e.g. FK violation because a component_id doesn't exist in the `components` table), the error is logged to stderr and the loop continues. One bad record never aborts the rest.

```typescript
for (const p of prices) {
  try {
    await _sql`INSERT ... ON CONFLICT ...`;
    updated++;
  } catch (err) {
    errors++;
    console.error(`[aggregator] Failed to upsert ...`, err);
  }
}
```

---

## What's next

Task 10.5 — Scheduler: wires everything together with `Bun.cron()` to run the full scraping session every 24 hours.
