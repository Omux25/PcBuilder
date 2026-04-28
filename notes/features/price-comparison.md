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

## How the frontend displays prices

### PriceComparison component

The `PriceComparison` component fetches prices when a component is selected in the configurator. It:

1. Separates in-stock offers from out-of-stock offers
2. Shows in-stock offers first, sorted cheapest first
3. Highlights the cheapest in-stock offer
4. Shows out-of-stock offers below with a visual distinction
5. Shows the variant column only when labels differ across offers
6. Each row has a "Voir →" link that opens the retailer's product page in a new tab

### PriceHistoryChart component

A line chart (using Recharts) showing price over time. One line per retailer. Tooltip shows exact price and date on hover. Shows a "Price history not yet available" message when fewer than 2 data points exist.

### ComponentDetail page

The detail page for a single component (accessed via `/components/:slug`) shows:
- Component image, name, brand
- Specs table with French labels (e.g. "Fréquence de base (GHz)" instead of "base_clock_ghz")
- Price comparison table
- Price history chart
- "Add to Build" button

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
