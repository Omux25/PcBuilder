# Task 10.2 — Abstract Base Scraper (`scraper/scrapers/baseScraper.ts`)

## What was built

An abstract class that handles the common HTTP fetch + HTML parse logic. Site-specific scrapers extend it and only implement `extractPrices()`.

---

## Files created

- `backend/scraper/scrapers/baseScraper.ts` — the abstract base class
- `backend/scraper/scrapers/__tests__/baseScraper.test.ts` — 11 unit tests
- `backend/scraper/scrapers/__tests__/tsconfig.json` — test tsconfig

---

## The `ScrapedPrice` type

```typescript
interface ScrapedPrice {
  component_id: number;   // FK → components.id
  retailer_id:  number;   // FK → retailers.id
  price:        number;   // price in MAD
  in_stock:     boolean;
  product_url:  string;   // direct link to the product page
}
```

This is the data contract between scrapers and the aggregator.

---

## How it works

```typescript
abstract class BaseScraper {
  readonly siteName: string;

  async scrape(url: string): Promise<ScrapedPrice[]> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    return this.extractPrices($);
  }

  protected abstract extractPrices($: CheerioAPI): ScrapedPrice[];
}
```

`scrape()` handles the network layer. `extractPrices()` is the only thing a subclass needs to implement — it receives a ready-to-query Cheerio object and returns price records.

### Error propagation

`scrape()` throws on any HTTP error (4xx, 5xx) or network failure. It does **not** catch these — that's the scheduler's job. The scheduler wraps each `scrape()` call in a `try/catch`, logs the error, and continues to the next scraper. One broken site never stops the session.

---

## Dependency injection

`_fetch` and `_load` are module-level variables that can be replaced in tests:

```typescript
setFetch((url) => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('<html>...') }));
setLoad(cheerio.load); // or a custom mock
```

This avoids real HTTP calls in tests while still exercising the full `scrape()` logic.

---

## What's next

Task 10.3 — Site-specific scrapers: two concrete subclasses (`site1Scraper.ts`, `site2Scraper.ts`) that implement `extractPrices()` for real Moroccan retailer pages.
