# Design Document — PC Builder Platform Expansion

## Overview

This document defines the technical design for expanding the PC Builder platform from an MVP into a production-ready system. The expansion introduces a canonical component catalog, an admin panel, price history tracking, improved user interface, and deployment infrastructure.


## Architecture Changes

### Current Architecture (MVP)
- Backend: Bun + Hono REST API
- Database: PostgreSQL with 5 tables (components, retailers, prices, scraper_logs, admins)
- Scraper: cheerio + undici, runs every 24h via Bun.cron()
- Frontend: React + Vite with 3 components (Configurator, BuildSummary, PriceComparison)

### New Architecture (Expansion)
- **Canonical Catalog Model**: Components are curated by admins; scrapers link to existing components via `scraper_mappings` table
- **Admin Panel**: Separate React app at `/admin` with full CRUD for components, retailers, scrapers, and preset builds
- **Price History**: New `price_history` table tracking all price changes over time
- **Enhanced Frontend**: React Router, searchable pickers, component detail pages, price charts
- **Deployment**: Docker Compose with Nginx reverse proxy, health endpoint, environment-based config


---

## Database Schema Changes

### New Tables

#### `scraper_mappings`
Links retailer product URLs to canonical components.

```sql
CREATE TABLE scraper_mappings (
  id SERIAL PRIMARY KEY,
  component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  retailer_id INTEGER NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  product_url TEXT NOT NULL,
  product_identifier TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(retailer_id, product_url)
);

CREATE INDEX idx_scraper_mappings_component ON scraper_mappings(component_id);
CREATE INDEX idx_scraper_mappings_retailer ON scraper_mappings(retailer_id);
```

#### `price_history`
Records every price change for time-series analysis.

```sql
CREATE TABLE price_history (
  id SERIAL PRIMARY KEY,
  component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  retailer_id INTEGER NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  in_stock BOOLEAN NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_price_history_component_recorded ON price_history(component_id, recorded_at DESC);
CREATE INDEX idx_price_history_retailer ON price_history(retailer_id);
```

#### `preset_builds`
Curated PC builds for different use cases.

```sql
CREATE TABLE preset_builds (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  use_case VARCHAR(50) NOT NULL, -- gaming, workstation, office, budget
  total_price_estimate DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `preset_build_components`
Junction table linking preset builds to components.

```sql
CREATE TABLE preset_build_components (
  id SERIAL PRIMARY KEY,
  preset_build_id INTEGER NOT NULL REFERENCES preset_builds(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  UNIQUE(preset_build_id, category)
);
```

#### `unmatched_listings`
Queue of scraped products that couldn't be matched to catalog.

```sql
CREATE TABLE unmatched_listings (
  id SERIAL PRIMARY KEY,
  retailer_id INTEGER NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  product_url TEXT NOT NULL,
  scraped_name TEXT NOT NULL,
  scraped_price DECIMAL(10, 2),
  scraped_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'pending', -- pending, linked, dismissed
  linked_component_id INTEGER REFERENCES components(id) ON DELETE SET NULL,
  UNIQUE(retailer_id, product_url)
);
```

#### `admin_activity_log`
Audit trail for admin actions.

```sql
CREATE TABLE admin_activity_log (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- component_created, component_updated, etc.
  entity_type VARCHAR(50), -- component, retailer, preset_build
  entity_id INTEGER,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_activity_created ON admin_activity_log(created_at DESC);
```


### Modified Tables

#### `components` (expanded)
Add new fields for canonical catalog model.

```sql
ALTER TABLE components
  ADD COLUMN slug VARCHAR(255) UNIQUE NOT NULL,
  ADD COLUMN brand VARCHAR(100),
  ADD COLUMN description TEXT,
  ADD COLUMN specs JSONB, -- category-specific specs
  ADD COLUMN image_url TEXT,
  ADD COLUMN release_year INTEGER,
  ADD COLUMN is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX idx_components_slug ON components(slug);
CREATE INDEX idx_components_category ON components(category);
CREATE INDEX idx_components_brand ON components(brand);
CREATE INDEX idx_components_active ON components(is_active);
```

**Slug generation logic**: `slugify(brand + ' ' + name)` with numeric suffix on collision.

**Specs JSONB structure** (category-specific):
- CPU: `{ socket, cores, threads, base_clock_ghz, boost_clock_ghz, tdp }`
- Motherboard: `{ socket, chipset, form_factor, ram_slots, max_ram_gb, supported_ram_types, max_ram_frequency }`
- GPU: `{ chipset, vram_gb, length_mm, tdp, pcie_version }`
- RAM: `{ ram_type, capacity_gb, frequency_mhz, cas_latency, voltage }`
- Storage: `{ type, capacity_gb, interface, read_speed_mbps, write_speed_mbps }`
- PSU: `{ wattage, efficiency_rating, modular, form_factor }`
- Case: `{ form_factor, max_gpu_length_mm, max_cpu_cooler_height_mm, drive_bays }`
- Cooling: `{ type, socket_compatibility, tdp_rating, fan_size_mm, noise_level_db }`

#### `retailers` (expanded)
Add scraping configuration fields.

```sql
ALTER TABLE retailers
  ADD COLUMN logo_url TEXT,
  ADD COLUMN country VARCHAR(2) DEFAULT 'MA',
  ADD COLUMN is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN scraping_interval_hours INTEGER DEFAULT 24,
  ADD COLUMN last_scrape_at TIMESTAMP,
  ADD COLUMN last_scrape_status VARCHAR(50), -- SUCCESS, PARTIAL, FAILED
  ADD COLUMN notes TEXT;
```


---

## API Design

### New Public Endpoints

#### `GET /api/components/:id/price-history`
Returns price history for a component.

**Query Parameters:**
- `retailer_id` (optional): filter by retailer
- `days` (optional, default 30): number of days to return

**Response:**
```json
{
  "component_id": 123,
  "history": [
    {
      "retailer_id": 1,
      "retailer_name": "Electro Bazar",
      "price": 2499.00,
      "in_stock": true,
      "recorded_at": "2026-04-20T10:00:00Z"
    }
  ]
}
```

#### `GET /api/builds/presets`
Returns list of preset builds.

**Query Parameters:**
- `use_case` (optional): filter by use case (gaming, workstation, office, budget)

**Response:**
```json
{
  "presets": [
    {
      "id": 1,
      "name": "Budget Gaming Build",
      "description": "Entry-level gaming PC for 1080p",
      "use_case": "gaming",
      "total_price_estimate": 8500.00,
      "components": {
        "cpu": { "id": 10, "name": "AMD Ryzen 5 5600", "slug": "amd-ryzen-5-5600" },
        "motherboard": { "id": 25, "name": "MSI B550-A PRO", "slug": "msi-b550-a-pro" }
      }
    }
  ]
}
```

#### `GET /api/health`
Health check endpoint for load balancers.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-27T14:30:00Z"
}
```


### New Admin Endpoints

All admin endpoints require `Authorization: Bearer <JWT>` header.

#### `GET /api/admin/dashboard`
Returns dashboard statistics.

**Response:**
```json
{
  "stats": {
    "total_components": 150,
    "components_by_category": { "cpu": 20, "motherboard": 18, "gpu": 25 },
    "total_retailers": 5,
    "active_retailers": 4,
    "total_price_records": 450,
    "unmatched_listings_count": 12,
    "last_scrape": {
      "time": "2026-04-27T02:00:00Z",
      "status": "SUCCESS"
    }
  },
  "price_updates_chart": [
    { "date": "2026-04-20", "count": 120 },
    { "date": "2026-04-21", "count": 115 }
  ],
  "recent_activity": [
    {
      "action": "component_created",
      "entity_type": "component",
      "entity_id": 151,
      "admin_email": "admin@pcbuilder.ma",
      "created_at": "2026-04-27T10:15:00Z"
    }
  ]
}
```

#### `POST /api/admin/components/import`
Bulk import components from CSV or JSON.

**Request:** `multipart/form-data` with `file` field

**Response:**
```json
{
  "total_rows": 100,
  "imported": 85,
  "skipped": 10,
  "failed": 5,
  "errors": [
    { "row": 12, "field": "socket", "message": "Required field missing" }
  ]
}
```

#### `GET /api/admin/retailers`
List all retailers with scraping stats.

**Response:**
```json
{
  "retailers": [
    {
      "id": 1,
      "name": "Electro Bazar",
      "base_url": "https://electrobazar.ma",
      "is_active": true,
      "scraping_interval_hours": 24,
      "last_scrape_at": "2026-04-27T02:00:00Z",
      "last_scrape_status": "SUCCESS",
      "price_records_count": 120
    }
  ]
}
```

#### `POST /api/admin/retailers/:id/scrape`
Trigger immediate scraping for a retailer.

**Response:**
```json
{
  "job_id": "scrape-1-1714219200",
  "status": "started",
  "retailer_id": 1
}
```

#### `GET /api/admin/unmatched-listings`
List unmatched scraped products.

**Query Parameters:**
- `status` (optional): pending, linked, dismissed
- `retailer_id` (optional)

**Response:**
```json
{
  "listings": [
    {
      "id": 45,
      "retailer_id": 2,
      "retailer_name": "Mattel",
      "product_url": "https://mattel.ma/product/12345",
      "scraped_name": "AMD Ryzen 5 7600X Processor",
      "scraped_price": 2599.00,
      "scraped_at": "2026-04-27T02:15:00Z",
      "status": "pending"
    }
  ]
}
```

#### `POST /api/admin/unmatched-listings/:id/link`
Link an unmatched listing to a component.

**Request Body:**
```json
{
  "component_id": 123
}
```

**Response:**
```json
{
  "success": true,
  "scraper_mapping_id": 89
}
```

#### `POST /api/admin/preset-builds`
Create a preset build.

**Request Body:**
```json
{
  "name": "Budget Gaming Build",
  "description": "Entry-level gaming PC",
  "use_case": "gaming",
  "components": {
    "cpu": 10,
    "motherboard": 25,
    "gpu": 40,
    "ram": 55,
    "storage": 70,
    "psu": 85,
    "case": 100
  }
}
```


#### `POST /api/auth/refresh`
Refresh access token using refresh token.

**Request:** Refresh token sent via `HttpOnly` cookie

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 900
}
```

#### `POST /api/auth/logout`
Invalidate refresh token and clear session.

**Response:**
```json
{
  "success": true
}
```


---

## Frontend Design

### User-Facing App (React + Vite)

#### Routes (React Router)
- `/` — Home/Configurator
- `/components/:slug` — Component detail page
- `/build` — Build summary page
- `/presets` — Browse preset builds

#### Component Detail Page (`/components/:slug`)
**Layout:**
- Hero section: component image, name, brand, category badge
- Specs table: category-specific technical specs from JSONB
- Price comparison table: current offers sorted ascending
- Price history chart: line chart showing price over time (past 30 days)
- "Add to Build" button

**Price History Chart:**
- Library: Chart.js or Recharts
- X-axis: date
- Y-axis: price (MAD)
- Multiple lines: one per retailer
- Tooltip: shows exact price and date on hover

#### Searchable Component Picker
Replaces dropdown selects in Configurator.

**Features:**
- Debounced search input (300ms delay)
- Filter chips: brand, socket, RAM type, price range
- "Compatible only" toggle (filters based on current build)
- Thumbnail images with fallback to category icon
- Pagination: 20 items per page

**API Call:**
```
GET /api/components?category=cpu&search=ryzen&brand=AMD&socket=AM5&page=1&limit=20
```


### Admin Panel (React + Vite)

Separate app served at `/admin` route.

#### Routes
- `/admin/login` — Login page
- `/admin/dashboard` — Dashboard overview
- `/admin/components` — Component list + CRUD
- `/admin/components/import` — Bulk import interface
- `/admin/retailers` — Retailer list + CRUD
- `/admin/scrapers` — Scraper status + manual triggers
- `/admin/unmatched` — Unmatched listings queue
- `/admin/presets` — Preset builds CRUD
- `/admin/logs` — Scraper logs viewer

#### Dashboard Page
**Widgets:**
- Stats cards: total components, active retailers, price records, unmatched listings
- Price updates chart: bar chart showing updates per day (past 30 days)
- Recent activity feed: last 10 admin actions with timestamps
- Quick actions: "Run All Scrapers", "Import Components"

**Auto-refresh:** Dashboard stats refresh every 60 seconds via polling.

#### Component Management
**List View:**
- Search bar (searches name, brand, slug)
- Filters: category, active status
- Sort: name, brand, category, last updated
- Actions per row: Edit, Deactivate/Activate, Delete

**Create/Edit Form:**
- Dynamic form: shows only relevant spec fields based on selected category
- Image upload: drag-and-drop or file picker, stores URL in `image_url`
- Slug: auto-generated from brand + name, editable
- Validation: Zod schema per category

#### Bulk Import Interface
**Steps:**
1. Upload CSV or JSON file
2. Preview: shows first 10 rows with validation status
3. Conflict resolution: for duplicate slugs, show side-by-side comparison with options (skip, overwrite, merge)
4. Confirm and import
5. Results: shows imported/skipped/failed counts with downloadable error report

#### Scraper Management
**Status Dashboard:**
- Table: retailer name, last run time, status badge (SUCCESS/PARTIAL/FAILED), prices updated, unmatched count
- Actions per row: "Run Now", "View Logs"
- Global action: "Run All Scrapers"

**Live Log Viewer:**
- Real-time log stream (WebSocket or polling)
- Filters: retailer, severity (INFO, WARNING, ERROR), date range
- Auto-scroll to bottom
- Export logs as CSV

#### Unmatched Listings Queue
**List View:**
- Table: retailer, scraped name, price, URL, scraped date
- Actions per row: "Link to Component" (opens modal), "Dismiss"
- Link modal: searchable component picker, creates `scraper_mappings` entry on confirm


---

## Scraper Design Changes

### Current Flow (MVP)
1. Scraper runs every 24h via `Bun.cron()`
2. Scraper extracts product data from retailer HTML
3. Aggregator UPSERTs into `prices` table
4. Logger writes to `scraper_logs`

### New Flow (Expansion)
1. Scraper runs per-retailer based on `scraping_interval_hours`
2. Scraper extracts product URL, name, price, stock
3. Aggregator looks up `scraper_mappings` by `(retailer_id, product_url)`
4. **If mapping exists:** UPSERT into `prices`, check if price changed, insert into `price_history` if different
5. **If no mapping:** INSERT into `unmatched_listings` with status `pending`
6. Logger writes to `scraper_logs` with counts (matched, unmatched, errors)

### Scraper Mapping Workflow
**Admin creates mapping:**
1. Admin reviews `unmatched_listings` in Admin Panel
2. Admin searches for matching component in catalog
3. Admin clicks "Link" → creates `scraper_mappings` entry
4. Next scraper run will match this product URL and update `prices`

**Automatic mapping (future enhancement):**
- Fuzzy matching algorithm: compare scraped name to catalog names using Levenshtein distance
- Auto-link if confidence > 90%, otherwise add to `unmatched_listings`

### Price History Logic
```typescript
async function updatePrice(componentId: number, retailerId: number, newPrice: number, inStock: boolean) {
  // Get current price from prices table
  const currentPrice = await db.query(
    'SELECT price FROM prices WHERE component_id = $1 AND retailer_id = $2',
    [componentId, retailerId]
  );

  // UPSERT into prices
  await db.query(
    `INSERT INTO prices (component_id, retailer_id, price, in_stock, last_updated)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (component_id, retailer_id)
     DO UPDATE SET price = $3, in_stock = $4, last_updated = NOW()`,
    [componentId, retailerId, newPrice, inStock]
  );

  // If price changed, insert into price_history
  if (!currentPrice || currentPrice.price !== newPrice) {
    await db.query(
      'INSERT INTO price_history (component_id, retailer_id, price, in_stock) VALUES ($1, $2, $3, $4)',
      [componentId, retailerId, newPrice, inStock]
    );
  }
}
```

### Retry Logic with Exponential Backoff
```typescript
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { timeout: 10000 });
      if (response.ok) return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```


---

## Authentication Design

### Current (MVP)
- Single JWT with 24h expiry
- No refresh mechanism
- Admin must re-login every 24h

### New (Expansion)
- **Access Token**: JWT with 15-minute expiry, sent in response body
- **Refresh Token**: Opaque token with 7-day expiry, stored in `HttpOnly` cookie
- **Refresh Flow**: Frontend automatically requests new access token when expired

### Token Storage
**Backend:**
```sql
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

**Frontend:**
- Access token: stored in memory (React state)
- Refresh token: `HttpOnly` cookie (not accessible to JavaScript)

### Login Flow
1. User submits email + password to `POST /api/auth/login`
2. Backend validates credentials (bcrypt compare)
3. Backend generates access token (JWT, 15min expiry) and refresh token (random UUID, 7day expiry)
4. Backend stores refresh token in `refresh_tokens` table
5. Backend returns access token in JSON body and sets refresh token as `HttpOnly` cookie
6. Frontend stores access token in memory

### Token Refresh Flow
1. Frontend detects access token expired (401 response or JWT expiry check)
2. Frontend calls `POST /api/auth/refresh` (refresh token sent automatically via cookie)
3. Backend validates refresh token from `refresh_tokens` table
4. Backend generates new access token
5. Backend returns new access token in JSON body
6. Frontend updates access token in memory

### Logout Flow
1. User clicks "Logout"
2. Frontend calls `POST /api/auth/logout`
3. Backend deletes refresh token from `refresh_tokens` table
4. Backend clears `HttpOnly` cookie
5. Frontend clears access token from memory and redirects to login

### Middleware Changes
```typescript
// authMiddleware.ts
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } }, 401);
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    c.set('admin', decoded); // Attach admin info to context
    await next();
  } catch (error) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }, 401);
  }
}
```


---

## Deployment Design

### Docker Compose Architecture

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/src/db/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgres://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3000
      NODE_ENV: production
      SERVE_STATIC: "true"
    volumes:
      - ./frontend/dist:/app/frontend/dist
    depends_on:
      - postgres
    ports:
      - "3000:3000"

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
```

### Backend Dockerfile

```dockerfile
FROM oven/bun:1.3-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["bun", "run", "src/server.ts"]
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name pcbuilder.ma;

    # Frontend static files
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Admin panel
    location /admin {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /admin/index.html;
    }
}
```

### Environment Variables

`.env.example`:
```bash
# Database
DB_NAME=pcbuilder
DB_USER=pcbuilder_user
DB_PASSWORD=your_secure_password_here

# JWT
JWT_SECRET=your_jwt_secret_here_min_32_chars

# Backend
PORT=3000
NODE_ENV=production
SERVE_STATIC=true

# Frontend (build time)
VITE_API_BASE_URL=https://pcbuilder.ma/api
```

### Health Check Endpoint

```typescript
// backend/src/routes/health.ts
import { Hono } from 'hono';

const health = new Hono();

health.get('/', async (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

export default health;
```

### Static File Serving (Production Mode)

```typescript
// backend/src/app.ts
import { serveStatic } from 'hono/bun';

if (process.env.NODE_ENV === 'production' && process.env.SERVE_STATIC === 'true') {
  app.use('/*', serveStatic({ root: './frontend/dist' }));
}
```


---

## Seed Data Design

### Seed Dataset Requirements
- Minimum 150 real-world components
- Coverage: all 8 categories (CPU, Motherboard, GPU, RAM, Storage, PSU, Case, Cooling)
- Representative of Moroccan market (products actually available)
- Mix of budget, mid-range, and high-end options

### Seed File Structure

`backend/seed_catalog.sql`:
```sql
-- CPUs (20 components)
INSERT INTO components (slug, name, brand, category, specs, image_url, release_year, is_active) VALUES
('amd-ryzen-5-7600x', 'Ryzen 5 7600X', 'AMD', 'cpu', '{"socket":"AM5","cores":6,"threads":12,"base_clock_ghz":4.7,"boost_clock_ghz":5.3,"tdp":105}', NULL, 2022, true),
('intel-core-i5-13600k', 'Core i5-13600K', 'Intel', 'cpu', '{"socket":"LGA1700","cores":14,"threads":20,"base_clock_ghz":3.5,"boost_clock_ghz":5.1,"tdp":125}', NULL, 2022, true);

-- Motherboards (18 components)
INSERT INTO components (slug, name, brand, category, specs, image_url, release_year, is_active) VALUES
('msi-b650-gaming-plus-wifi', 'B650 GAMING PLUS WIFI', 'MSI', 'motherboard', '{"socket":"AM5","chipset":"B650","form_factor":"ATX","ram_slots":4,"max_ram_gb":128,"supported_ram_types":["DDR5"],"max_ram_frequency":6000}', NULL, 2023, true);

-- GPUs (25 components)
-- RAMs (20 components)
-- Storage (20 components)
-- PSUs (18 components)
-- Cases (15 components)
-- Cooling (14 components)
```

### Seed Retailers

```sql
INSERT INTO retailers (name, base_url, logo_url, country, is_active, scraping_interval_hours) VALUES
('Electro Bazar', 'https://electrobazar.ma', NULL, 'MA', true, 24),
('Mattel', 'https://mattel.ma', NULL, 'MA', true, 24),
('Mytek', 'https://mytek.tn', NULL, 'TN', true, 24),
('Wiki', 'https://wiki.tn', NULL, 'TN', true, 24),
('Tunisianet', 'https://tunisianet.com.tn', NULL, 'TN', true, 24);
```

### Seed Preset Builds

```sql
-- Budget Gaming Build
INSERT INTO preset_builds (name, description, use_case, total_price_estimate, is_active) VALUES
('Budget Gaming Build', 'Entry-level 1080p gaming PC', 'gaming', 8500.00, true);

INSERT INTO preset_build_components (preset_build_id, component_id, category) VALUES
(1, 10, 'cpu'),    -- AMD Ryzen 5 5600
(1, 25, 'motherboard'), -- MSI B550-A PRO
(1, 40, 'gpu'),    -- RX 6600
(1, 55, 'ram'),    -- 16GB DDR4 3200MHz
(1, 70, 'storage'), -- 500GB NVMe SSD
(1, 85, 'psu'),    -- 550W 80+ Bronze
(1, 100, 'case');  -- Basic ATX case

-- High-End Workstation
INSERT INTO preset_builds (name, description, use_case, total_price_estimate, is_active) VALUES
('High-End Workstation', '4K video editing and 3D rendering', 'workstation', 25000.00, true);
```


---

## Performance Optimizations

### Database Indexes
All indexes defined in schema changes above. Key indexes:
- `components(slug)` — for component detail page lookups
- `components(category)` — for category filtering
- `prices(component_id)` — for price lookups
- `price_history(component_id, recorded_at DESC)` — for price history queries
- `scraper_mappings(component_id, retailer_id)` — for scraper lookups

### API Pagination
All list endpoints support pagination:
- Query params: `page` (default 1), `limit` (default 20, max 100)
- Response header: `X-Total-Count` with total matching records
- SQL: `LIMIT $1 OFFSET $2`

### Frontend Optimizations
- **Debounced search**: 300ms delay on search input to reduce API calls
- **Image lazy loading**: `loading="lazy"` on component images
- **Code splitting**: React Router lazy loading for routes
- **Chart data caching**: Cache price history data for 5 minutes in React state

### Caching Strategy (Future Enhancement)
- Redis cache for frequently accessed data (component lists, price offers)
- Cache invalidation on scraper updates
- TTL: 5 minutes for component lists, 1 hour for price history


---

## Migration Strategy

### Phase 1: Database Schema Migration
1. Run new migration scripts to add columns to `components` and `retailers`
2. Create new tables: `scraper_mappings`, `price_history`, `preset_builds`, `preset_build_components`, `unmatched_listings`, `admin_activity_log`, `refresh_tokens`
3. Backfill existing `components` with slugs: `UPDATE components SET slug = slugify(name)`
4. Backfill existing `prices` into `price_history`: `INSERT INTO price_history SELECT component_id, retailer_id, price, in_stock, last_updated FROM prices`

### Phase 2: Backend API Updates
1. Update component service to use new schema fields
2. Add new endpoints (price history, presets, admin dashboard, etc.)
3. Update auth system with refresh tokens
4. Update scraper to use `scraper_mappings` and `unmatched_listings`

### Phase 3: Frontend Updates
1. Add React Router
2. Build component detail pages
3. Build admin panel
4. Update Configurator with searchable pickers

### Phase 4: Seed Data
1. Run `seed_catalog.sql` to populate 150+ components
2. Create initial preset builds
3. Create initial scraper mappings for known products

### Phase 5: Deployment
1. Build Docker images
2. Configure environment variables
3. Deploy to VPS with Docker Compose
4. Run database migrations
5. Verify health endpoint

### Rollback Plan
- Keep old schema columns until migration verified
- Database backups before each migration step
- Feature flags for new UI components


---

## Testing Strategy

### Backend Tests
- **Unit tests**: All new services, middleware, and utilities
- **Integration tests**: Full API endpoint tests with test database
- **Property-based tests**: Pagination logic, price history insertion, slug generation uniqueness

### Frontend Tests
- **Component tests**: React Testing Library for all new components
- **E2E tests**: Playwright for critical user flows (search component, view price history, create preset build)

### Test Database
- Separate test database: `pcbuilder_test`
- Reset before each test suite
- Seed with minimal test data

### CI/CD
- GitHub Actions workflow
- Run tests on every push
- Build Docker images on main branch
- Deploy to staging environment on successful build


---

## File Structure

```
backend/
├── src/
│   ├── db/
│   │   └── migrations/
│   │       ├── 001_create_components.sql (modified)
│   │       ├── 002_create_retailers.sql (modified)
│   │       ├── 006_create_scraper_mappings.sql (new)
│   │       ├── 007_create_price_history.sql (new)
│   │       ├── 008_create_preset_builds.sql (new)
│   │       ├── 009_create_unmatched_listings.sql (new)
│   │       ├── 010_create_admin_activity_log.sql (new)
│   │       └── 011_create_refresh_tokens.sql (new)
│   ├── routes/
│   │   ├── admin/
│   │   │   ├── components.ts (modified)
│   │   │   ├── retailers.ts (new)
│   │   │   ├── scrapers.ts (new)
│   │   │   ├── unmatched.ts (new)
│   │   │   ├── presets.ts (new)
│   │   │   └── dashboard.ts (new)
│   │   ├── components.ts (modified)
│   │   ├── prices.ts (modified)
│   │   ├── presets.ts (new)
│   │   └── health.ts (new)
│   ├── services/
│   │   ├── componentService.ts (modified)
│   │   ├── priceHistoryService.ts (new)
│   │   ├── presetService.ts (new)
│   │   ├── retailerService.ts (new)
│   │   └── slugService.ts (new)
│   ├── middleware/
│   │   └── auth.ts (modified)
│   └── utils/
│       └── slugify.ts (new)
├── scraper/
│   ├── aggregator.ts (modified)
│   └── scheduler.ts (modified)
├── seed_catalog.sql (new)
├── Dockerfile (new)
└── .env.example (modified)

frontend/
├── src/
│   ├── pages/
│   │   ├── Home.tsx (Configurator)
│   │   ├── ComponentDetail.tsx (new)
│   │   ├── BuildSummary.tsx
│   │   └── Presets.tsx (new)
│   ├── components/
│   │   ├── Configurator.tsx (modified)
│   │   ├── ComponentPicker.tsx (new)
│   │   ├── PriceHistoryChart.tsx (new)
│   │   └── BuildSummary.tsx (modified)
│   ├── api.ts (modified)
│   └── router.tsx (new)

admin/
├── src/
│   ├── pages/
│   │   ├── Login.tsx (new)
│   │   ├── Dashboard.tsx (new)
│   │   ├── Components.tsx (new)
│   │   ├── ComponentForm.tsx (new)
│   │   ├── BulkImport.tsx (new)
│   │   ├── Retailers.tsx (new)
│   │   ├── Scrapers.tsx (new)
│   │   ├── UnmatchedListings.tsx (new)
│   │   └── Presets.tsx (new)
│   ├── components/
│   │   ├── StatsCard.tsx (new)
│   │   ├── ActivityFeed.tsx (new)
│   │   └── LogViewer.tsx (new)
│   ├── api.ts (new)
│   └── router.tsx (new)

docker-compose.yml (new)
nginx.conf (new)
```

---

## Summary

This design transforms the PC Builder platform from an MVP into a production-ready system with:

1. **Canonical Catalog**: Clean, admin-curated component database with 150+ seed components
2. **Admin Panel**: Full-featured React app for managing components, retailers, scrapers, and presets
3. **Price History**: Time-series tracking with charts on component detail pages
4. **Enhanced UX**: Searchable pickers, React Router, component detail pages
5. **Deployment Ready**: Docker Compose, health endpoint, environment-based config
6. **Scalable**: Pagination, indexes, proper auth with refresh tokens

All requirements from the requirements document are addressed with concrete technical implementations.
