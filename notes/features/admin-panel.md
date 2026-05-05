# Admin Panel

The admin panel is a separate React + Vite application (`apps/admin/`) that gives administrators full control over the platform. It runs on port 5174 in development and is served at `/admin` in production.

All admin panel pages require authentication. The panel handles token refresh automatically — admins stay logged in for 7 days without interruption.

---

## Pages

### Login

Email + password form. On submit, calls `POST /api/auth/login`. Stores the access token in memory (not localStorage). Redirects to the dashboard on success. Shows a clear error message on invalid credentials.

### Dashboard

The first thing an admin sees after logging in. Auto-refreshes every 60 seconds.

**Stats cards:**
- Total components in the catalog
- Active retailers (currently scraping)
- Total price records in the database
- Unmatched listings waiting for review

**Price updates chart:** A bar chart (Recharts) showing how many prices were updated per day over the past 30 days. Useful for spotting scraper outages — a day with zero updates means something broke.

**Recent activity feed:** The last 10 admin actions (component created, retailer updated, listing linked, etc.) with timestamps.

### Components

The main catalog management page.

**List view:**
- Search by name/brand
- Filter by category and active status
- Sort controls
- Actions per row: Edit, Deactivate/Activate, Delete (with confirmation dialog)

**Create/Edit form:**
- Dynamic spec fields based on the selected category (CPU shows socket field, GPU shows length_mm, etc.)
- Image URL field
- Auto-generated slug preview (updates as you type name/brand)
- Zod validation on submit — errors shown inline

**Delete behavior:** A component can only be deleted if it has no linked prices. If it does, the API returns HTTP 409 and the UI shows an explanation. Use "Deactivate" instead to hide it from the public without losing price history.

**Activate/Deactivate toggle:** The eye icon toggles `is_active`. Deactivated components are hidden from the public API but all their data is preserved.

**Unlink button:** The chain-break icon removes all scraper mappings and prices for a component, resets its linked unmatched listings back to "pending" status, and deactivates the component. Use this to send a component back to Non associés for re-review — for example, if the auto-catalog builder created a component with the wrong name or specs.

### Bulk Import

For adding many components at once.

1. Upload a CSV or JSON file
2. Preview the first 10 rows with validation status (green = valid, red = error with message)
3. Click Import — see results: X imported, Y skipped, Z failed

The import runs row-by-row. Each row is validated and inserted independently. If a row fails, it is counted as failed and the import continues. Slug collisions are automatically counted as `skipped` — the existing component is kept and the duplicate row is not inserted. Successfully imported rows are not rolled back on later failures.

### Retailers

Manage the retailer list.

**List view:** Name, active status, last scrape time, price records count, scraping interval.

**Create/Edit form:** Name, base URL, logo URL, country, scraping interval (hours), notes.

**Deactivate/Activate toggle:** Deactivated retailers are skipped by the scheduler. Their existing price data is preserved.

### Scrapers

Monitor and control the scraping system.

**Status table:** One row per retailer showing last run time, status badge (success/error/running), prices updated count, unmatched count.

**"Run Now" button:** Triggers an immediate scrape for one retailer. Returns HTTP 409 if a scrape is already running for that retailer.

**"Run All" button:** Triggers all active retailers sequentially.

**Log viewer:** The last 100 scraper log entries, filterable by retailer, severity (INFO/WARNING/ERROR), and date range. Useful for diagnosing scraper failures.

### Unmatched Listings

Products that the scraper found but couldn't match to any catalog component. These need admin attention.

**Table columns:** Retailer, scraped product name, price, URL, date scraped.

**Grouped view:** The default view groups listings by canonical name (brand + model stripped of color/noise tokens). Each group shows the AI-computed category suggestion with a confidence badge (high/medium/low/unknown). High-confidence groups with an existing catalog match can be bulk-approved in one click.

**"Retraiter" button:** Forces recomputation of all suggestion categories using the latest keyword rules. Returns immediately (202) — processing runs in the background. Use this after adding a new keyword rule to see the updated categories.

**"Créer" button:** Opens a form pre-filled with the suggested name, brand, and category. Creates a new catalog component and links all listings in the group to it atomically.

**"Link" button:** Opens a modal with a searchable component picker. Select the matching component → creates a `scraper_mappings` entry → future scrapes will automatically match this product.

**"Dismiss" button:** Marks the listing as dismissed. Use this for products that are not PC components (accessories, peripherals, bundles).

Regularly reviewing unmatched listings is important — every linked product means more price data for users.

---

## Activity logging

Every write action in the admin panel is logged to the `admin_activity_log` table:

```
admin_id | action   | entity_type | entity_id | details (JSONB)       | created_at
---------|----------|-------------|-----------|----------------------|------------
1        | created  | component   | 42        | { name: "RTX 4090" } | 2026-04-28
1        | linked   | listing     | 15        | { component_id: 42 } | 2026-04-28
```

This log is shown in the dashboard's recent activity feed and provides an audit trail of all changes.

---

## Token refresh in the API client

`apps/admin/src/api.ts` wraps all fetch calls with automatic token refresh:

```
API call fails with 401
  → call POST /api/auth/refresh
  → if success: retry original request with new token
  → if failure: redirect to /admin/login
```

This is transparent to the admin — they never see a "session expired" error during normal use.

The `getErrorMessage(err)` helper in `api.ts` extracts a human-readable message from any thrown value — handles both `ApiError` plain objects (from the API client) and standard `Error` instances. All error handlers in the admin panel use this helper to ensure the actual backend error message is always shown instead of a generic fallback.
