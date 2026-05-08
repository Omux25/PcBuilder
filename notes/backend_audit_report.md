# 🛠️ Backend Architecture Audit & Fix Roadmap

This document outlines the "hidden" logic and design flaws identified in the PC Builder backend (specifically the scraping and matching engine). 

---

## 1. The "Scaling Death" (O(N²) Matching)
**Location:** `apps/backend/src/utils/componentMatcher.ts` & `apps/backend/scraper/autoMapper.ts`

### The Issue
The auto-mapper loads the **entire catalog** into memory and then loops through every unmatched listing, comparing it against every catalog item twice.
* **Complexity:** If you have 5k components and 2k unmatched listings, that's **10 million** regex operations per session.
* **Impact:** This is likely why GitHub Actions are timing out (15m+ runs). It will eventually crash the server as the catalog grows.

### The Fix
1. **Category Filtering:** Instead of matching against the whole catalog, only match unmatched items against components in the same "guessed" category.
2. **Indexed Search:** Use a basic string search (like `ILIKE`) in the database to narrow down the potential matches to ~50 candidates before running the expensive DNA regex.
3. **Caching:** Cache extracted DNA tokens for catalog components so they aren't re-extracted millions of times.

---

## 2. "Partial Scrape" Data Corruption
**Location:** `apps/backend/scraper/aggregator.ts` (Lines 219–254)

### The Issue
The system marks a product as "Out of Stock" if its URL wasn't seen in the current scrape.
* **The Flaw:** It assumes every scrape is 100% successful. If a scraper fails halfway through (network error, rate limit), the system incorrectly wipes out the stock status of thousands of valid products.
* **Impact:** Broken price history and "flickering" availability on the frontend.

### The Fix
1. **Threshold Check:** Before marking anything as out-of-stock, verify that the scraper returned a "sane" number of items (e.g., at least 80% of the previous run's count).
2. **Soft Expiry:** Instead of immediate "false", use a `last_seen_at` timestamp. Only mark as out-of-stock if the product hasn't been seen in the last 3 consecutive successful scrapes.

---

## 3. Database "Hammering" (N+1 Queries)
**Location:** `aggregator.ts` and `autoMapper.ts` loops.

### The Issue
The code performs individual `INSERT` and `UPDATE` statements inside large loops (sometimes 10,000+ iterations).
* **Impact:** Massive performance bottleneck. It can lock the database for minutes, making the website unresponsive during scrapes.

### The Fix
1. **Batching:** Accumulate results into arrays and use Bun.sql's bulk insert capabilities or a single `VALUES (...), (...), (...)` statement.
2. **Chunking:** Process products in chunks of 500 to balance memory usage and DB performance.

---

## 4. Non-Atomic Integrity (Missing Transactions)
**Location:** Throughout the scraper session.

### The Issue
Updates to `scraper_mappings`, `unmatched_listings`, and `prices` happen one after another without being wrapped in a transaction.
* **Impact:** If the script crashes mid-run, you get "Ghost Data" (e.g., a mapping exists but the listing is still marked as 'pending').
* **The Fix:** Use `sql.begin(async (tx) => { ... })` to ensure that either all related updates succeed together, or none of them do.

---

## 5. Memory Pressure (OOM Risk)
**Location:** `apps/backend/scraper/session.ts` (Line 65)

### The Issue
All scraped prices from all retailers are pushed into a single `allPrices` array before processing.
* **Impact:** On a small VPS, this will eventually trigger an Out-of-Memory (OOM) crash once you have 10+ retailers.
* **The Fix:** Move to a **Stream-based** or **Sequential** approach. Process each retailer's results fully (aggregate + map) before starting the next one, then clear the memory.

---

## 6. Brittle DNA Regex
**Location:** `apps/backend/src/utils/componentMatcher.ts`

### The Issue
The GPU/CPU regexes expect suffixes (like "SUPER" or "Ti") to appear in a very specific order and position.
* **Impact:** Retailers often have messy titles like `"ASUS DUAL RTX 4070 OC SUPER"`. The current regex will fail to find "SUPER" because "OC" is in the way.
* **The Fix:** Change the DNA extraction to be **token-based** rather than **regex-positional**. Extract all potential "DNA markers" from the string regardless of their order, then check if the required markers are present.

---

## 📋 Implementation Priority
1. **High:** Fix the "Partial Scrape" (Data Integrity).
2. **High:** Fix Batching/N+1 Queries (Performance/Stability).
3. **Medium:** Add Transactions (Consistency).
4. **Medium:** Refactor Matcher Complexity (Scaling).
