# 🚀 Backend API — PC Builder Morocco

This is the central API server for the PC Builder Morocco platform, powered by [Bun](https://bun.sh/) and [Hono](https://hono.dev/).

---

## 🏗️ Architecture

The backend follows a modular architecture to keep domain logic separated and maintainable.

### 📂 [**`src/core`**](./src/core)
Foundational logic used across all modules.
- **`db`** — Database connection (PostgreSQL) and migrations.
- **`middleware`** — Auth guards, CORS, and request logging.
- **`schemas`** — Zod validation schemas for API requests.

### 📂 [**`src/modules`**](./src/modules)
Feature-specific domains.
- [**`catalog`**](./src/modules/catalog) — Component data, prices, and search logic.
- [**`scraping`**](./src/modules/scraping) — Logic for orchestrating web scrapers across local retailers.
- [**`auth`**](./src/modules/auth) — User authentication and session management.
- [**`builds`**](./src/modules/builds) — PC build persistence and sharing.

### 📂 [**`scraper`**](./scraper)
Standalone scraper scripts and configurations for various Moroccan retailers.

---

## 🛠️ Development

### Setup

1. Copy `.env.example` to `.env`.
2. Ensure you have a PostgreSQL instance running.
3. Install dependencies:
   ```bash
   bun install
   ```

### Running

```bash
bun dev     # Hot-reload development mode
bun start   # Production mode
```

### Database Management

```bash
bun migrate   # Run database migrations
```

### Catalog Sync

To trigger a manual synchronization of the catalog from the scrapers:
```bash
bun sync
```

---

## 🧪 Testing

We use Bun's built-in test runner.
```bash
bun test
```
Tests are located in the [**`src/__tests__`**](./src/__tests__) directory.
