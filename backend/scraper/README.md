# Scraper System

Automatically collects prices from Moroccan retailer websites and writes them to the database. Runs on a per-retailer schedule via `Bun.cron()`.

For a full explanation of how the system works, see [../../notes/features/scraping-system.md](../../notes/features/scraping-system.md).

---

## Files

| File | What it does |
|---|---|
| `scheduler.ts` | Reads `scraping_interval_hours` per retailer from DB, runs scrapers on schedule |
| `aggregator.ts` | Takes `ScrapedPrice[]`, resolves mappings, extracts variants, UPSERTs prices, records history |
| `session.ts` | Runs one full scraping session (all active retailers) |
| `utils/logger.ts` | Structured logger — writes INFO/WARNING/ERROR entries to `scraper_logs` table |
| `scrapers/baseScraper.ts` | Abstract base — handles HTTP fetch (undici), HTML parse (cheerio), retry logic |
| `scrapers/ultrapcScraper.ts` | Scrapes ultrapc.ma (PrestaShop) — 279 mapped products |
| `scrapers/nextlevelScraper.ts` | Scrapes nextlevelpc.ma — category-based pagination |
| `scrapers/setupgameScraper.ts` | Scrapes setupgame.ma |

---

## Running manually

```powershell
# Run all scrapers once and aggregate results
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun scripts/run_all_scrapes.ts"
```

---

## How a product gets into the prices table

```
Scraper finds product URL
  → aggregator looks up scraper_mappings
  → if found: extract variant, UPSERT into prices, record history if price changed
  → if not found: INSERT into unmatched_listings
```

Unmatched listings are reviewed in the admin panel. Linking a listing creates a `scraper_mappings` entry — future scrapes will automatically match that product.
