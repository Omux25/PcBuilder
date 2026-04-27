# Task 10.3 — Site-Specific Scrapers

## What was built

Two concrete scraper classes that extend `BaseScraper` and implement `extractPrices()` for specific retailer page patterns. Both are placeholder implementations with clear `TODO` markers — ready to be wired to real sites.

---

## Files created

- `backend/scraper/scrapers/site1Scraper.ts` — listing page pattern
- `backend/scraper/scrapers/site2Scraper.ts` — individual product page pattern
- `backend/scraper/scrapers/__tests__/site1Scraper.test.ts` — 9 tests
- `backend/scraper/scrapers/__tests__/site2Scraper.test.ts` — 8 tests

---

## Two scraping patterns

### Site 1 — Listing page

One URL contains multiple product cards. Each card has a `data-component-id` attribute that maps to a row in the `components` table.

```
GET /informatique/composants
  → parse all .product-card elements
  → extract price, stock, URL from each card
  → return ScrapedPrice[]
```

**When to use this pattern:** The retailer has a category page that lists all PC components with prices visible without clicking into each product.

### Site 2 — Individual product pages

One URL per component. A `PRODUCT_URLS` map links each `component_id` to its product page URL.

```
for each (component_id, url) in PRODUCT_URLS:
  GET url
  → extract price, stock from the single product page
  → inject component_id (the page doesn't have it)
  → collect into ScrapedPrice[]
```

**When to use this pattern:** The retailer doesn't have a structured listing page, or prices are only visible on individual product pages.

---

## How to adapt to a real site

1. Open the retailer's page in Chrome, press F12 → Elements
2. Find the CSS selectors for price, stock status, and product URL
3. Update the `SELECTOR_*` constants at the top of the file
4. Update `SITE_NAME` and `RETAILER_ID` to match the `retailers` table
5. For Site 2: fill in the `PRODUCT_URLS` map with real component_id → URL pairs
6. Update the test HTML in `__tests__/site1Scraper.test.ts` to match the real selectors
7. Run `bun test` to verify

---

## Price parsing

Moroccan e-commerce sites often format prices as `"1 299,00 MAD"` or `"2 499 DH"`. The scrapers strip all non-numeric characters except the decimal separator and convert commas to dots:

```typescript
const price = parseFloat(rawPrice.replace(/[^\d,]/g, '').replace(',', '.'));
// "1 299,00 MAD" → "1299,00" → "1299.00" → 1299
```

Cards with unparseable prices (e.g. `"Prix sur demande"`) are silently skipped.

---

## What's next

Task 10.4 — Aggregator: takes all `ScrapedPrice[]` results and UPSERTs them into the `prices` table.
