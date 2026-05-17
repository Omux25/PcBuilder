# 🛡️ Admin Dashboard — PC Builder Morocco

Internal administrative interface for managing the catalog, retailers, and web scrapers.

---

## 🏗️ Architecture

The Admin dashboard is a dedicated React application designed for data management and operational monitoring.

### 📂 [**`src/pages`**](./src/pages)
Key administrative views.
- [**`Dashboard`**](./src/pages/Dashboard.tsx) — Overview of catalog health and scraper status.
- [**`Scrapers`**](./src/pages/Scrapers.tsx) — Monitor and trigger individual retailer scrapers.
- [**`Unmatched`**](./src/pages/Unmatched.tsx) — Interface for manually resolving scraped items that didn't automatically map to a canonical component.
- [**`KeywordRules`**](./src/pages/KeywordRules.tsx) — Manage the regex and keyword rules used for automated component identification.
- [**`BulkImport`**](./src/pages/BulkImport.tsx) — Tools for importing large datasets.

### 📂 [**`src/components`**](./src/components)
Specialized administrative components.
- [**`ScrapedListingRow`**](./src/components/ScrapedListingRow.tsx) — Visualizing raw data from scrapers.
- [**`TokenPicker`**](./src/components/TokenPicker.tsx) — UI for managing component metadata tokens.

---

## 🛠️ Development

### Setup

Install dependencies from the admin directory:
```bash
bun install
```

### Running

```bash
bun dev     # Start Vite development server
```

### Building

```bash
bun build   # Production build
```

---

## 🔑 Key Responsibilities

1. **Catalog Integrity:** Auditing and cleaning component specifications.
2. **Scraper Management:** Monitoring success rates and troubleshooting retailer changes.
3. **Price Normalization:** Ensuring prices from different retailers are correctly parsed and mapped.
4. **Keyword Engineering:** Tuning the "brain" that identifies components from messy raw strings.
