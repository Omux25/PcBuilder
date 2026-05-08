# Price Comparison

The price comparison feature shows all available offers for a component across Moroccan retailers, sorted by availability and price. It also tracks price history over time.

---

## How prices are stored

### The variant model

Each row in the `prices` table represents one specific product listing from one retailer — not just one price per (component, retailer) pair.

This matters because the same component can appear multiple times at the same retailer with different configurations:

- A GPU sold by three different AIB partners (Sapphire Pulse, MSI Gaming X, ASUS TUF) at different prices
- A CPU sold as BOX (with cooler) or Tray (without cooler)
- RAM sold as a single stick or a 2×16GB kit

The unique key is `(component_id, retailer_id, product_url)` — one row per distinct product URL.

Each row also stores:
- `variant_label` — human-readable label extracted from the scraped product name (e.g. "Sapphire Pulse", "Tray", "2x16GB CL30")
- `variant_details` — structured JSONB with category-specific metadata (AIB partner, packaging type, kit config, etc.)

### Price history

Every time the scraper runs and finds a price that has changed, it inserts a row into `price_history`. This table never updates — it only grows. This gives a full audit trail of price changes over time.

The `GET /api/components/:id/price-history` endpoint returns this history, optionally filtered by retailer and time window.

---

## The prices API

### `GET /api/components/:id/prices`

Returns all current price offers for a component, sorted in-stock first, then by price ascending.

```json
{
  "offers": [
    {
      "retailer_id": 10,
      "retailer_name": "UltraPC",
      "price": 4299.00,
      "in_stock": true,
      "product_url": "https://ultrapc.ma/...",
      "last_updated": "2026-04-28T10:00:00Z",
      "variant_label": "Sapphire Pulse",
      "variant_details": { "aib_partner": "Sapphire", "model_tier": "Pulse" }
    },
    {
      "retailer_id": 10,
      "retailer_name": "UltraPC",
      "price": 4599.00,
      "in_stock": true,
      "product_url": "https://ultrapc.ma/...",
      "variant_label": "MSI Gaming X",
      "variant_details": { "aib_partner": "MSI", "model_tier": "Gaming X" }
    },
    {
      "retailer_id": 11,
      "retailer_name": "NextLevel",
      "price": 4450.00,
      "in_stock": false,
      "product_url": "https://nextlevelpc.ma/...",
      "variant_label": "ASUS TUF Gaming",
      "variant_details": { "aib_partner": "ASUS", "model_tier": "TUF Gaming" }
    }
  ]
}
```

The variant column is only shown in the UI when at least two offers have different variant labels — otherwise it's hidden to keep the table clean.

### `GET /api/components/:id/price-history`

Returns price history entries, optionally filtered:

```
GET /api/components/42/price-history?retailer_id=10&days=30
```

```json
{
  "component_id": 42,
  "history": [
    { "retailer_id": 10, "retailer_name": "UltraPC", "price": 4299.00, "in_stock": true, "recorded_at": "2026-04-28T00:00:00Z" },
    { "retailer_id": 10, "retailer_name": "UltraPC", "price": 4399.00, "in_stock": true, "recorded_at": "2026-04-21T00:00:00Z" }
  ]
}
```

---

### CategoryBrowse Selection Table

In the new full-page browse workflow, the lowest available price for every component is displayed directly in the results table. This allows users to compare basic pricing across all compatible parts at a glance without expanding rows.

### PriceComparison (Inline Prices)

When a component is already selected in the configurator, clicking the row expands it to show the `InlinePrices` (or `PriceComparison`) component. This provides:
1.  **Detailed Offers**: List of every retailer offering the part, including variant details (e.g., "Sapphire Pulse" vs. "MSI Gaming X").
2.  **In-Stock Priority**: In-stock offers are shown first, sorted cheapest first.
3.  **Direct Links**: "Voir →" links redirect users to the retailer's product page.

### PriceHistoryChart

A line chart showing price trends over time for the selected component. Available in both expanded configurator rows and the standalone product detail page.

---

## How prices get into the database

Prices come from the scraping system. The full automated pipeline runs after every scrape session:

```
Scraper runs (every hour)
  → aggregate()          — prices known products, saves unknowns to unmatched_listings
  → autoMap()            — DNA matcher links unmatched to existing catalog entries
  → buildFromUnmatched() — extracts specs from product names, creates new catalog entries
                           (CPU, GPU, RAM, storage, motherboard only)
  → autoMap() pass 2     — links listings to newly created entries
  → session log: "312 updated, 47 unmatched, 12 auto-mapped, 8 new catalog entries"
```

No manual intervention needed for products the matcher can identify. Products the matcher cannot categorize (cases, coolers, PSUs, accessories, bundles) stay in `unmatched_listings` for admin review.

---

## Market Trends

The Market Trends feature surfaces components whose price has changed significantly over a recent window. It's powered by the `GET /api/market-trends` endpoint and displayed on the Market Trends page in the frontend.

### How it works

The endpoint queries `price_history` to find the cheapest in-stock price for each component on the first and last day of the requested window. It then computes the absolute and percentage change, and returns only components that moved in the requested direction (drops or hikes).

Only components that are currently in stock are included — a price drop on an out-of-stock item isn't useful to the user.

### Query parameters

| Parameter | Default | Description |
|---|---|---|
| `type` | `drops` | `drops` (price decreased) or `hikes` (price increased) |
| `days` | `7` | Lookback window in days (min 1, max 30) |
| `limit` | `20` | Max results (min 1, max 50) |
| `category` | — | Filter to one component category |

Invalid numeric values for `days` or `limit` fall back to defaults silently — no 400 error.

### Response fields

| Field | Description |
|---|---|
| `price_before` | Cheapest in-stock price on the first day of the window |
| `price_after` | Cheapest in-stock price on the last day of the window |
| `diff_amount` | Absolute price difference (always positive) |
| `change_pct` | Percentage change, rounded to 1 decimal place |
| `type` | `drops` or `hikes` — echoed from the request |

### Frontend display

The Market Trends page shows two tabs: Price Drops and Price Hikes. Each tab shows a card grid with the component image, name, price before/after, and the percentage change. A stock visibility toggle lets users hide out-of-stock items globally.
