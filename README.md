# 💻 PC Builder Morocco — Unified Project Workspace

Welcome to the **PC Builder Morocco** monorepo. This platform is designed to provide Moroccan enthusiasts with a high-fidelity PC configuration tool, real-time catalog from local retailers, and performance estimations.

---

## 🏗️ Project Architecture

The project is organized as a monorepo to maintain strict type safety and share business logic between the client and server.

- [**`apps/frontend`**](./apps/frontend) — The main user-facing PC configuration application.
- [**`apps/admin`**](./apps/admin) — Administrative dashboard for catalog management and scraper monitoring.
- [**`apps/backend`**](./apps/backend) — Hono/Bun API handling the database, scrapers, and build logic.
- [**`shared`**](./shared) — Core business logic, hardware specifications, and TypeScript definitions.

---

## 🛠️ Tech Stack

- **Runtime:** [Bun](https://bun.sh/)
- **Frontend:** [React](https://reactjs.org/) (TypeScript) + [Vite](https://vitejs.dev/)
- **Backend:** [Hono](https://hono.dev/)
- **Styling:** Vanilla CSS Modules
- **Data Visualization:** [Recharts](https://recharts.org/)
- **Icons:** [Lucide React](https://lucide.dev/)

---

## 🚀 Getting Started

### Prerequisites

- **Bun:** Ensure you have the [Bun runtime](https://bun.sh/) installed.
- **PowerShell:** The development scripts are written in PowerShell.

### Local Development

To start the entire environment (Frontend, Backend, and Admin) in parallel, run the root development script:

```powershell
./dev.ps1
```

### Common Commands

| Task | Command |
| :--- | :--- |
| **Backend Tests** | `bun test:backend` |
| **Lint All** | `bun lint:all` |
| **Clean Build Artifacts** | `bun clean` |

---

## 🗺️ Workspace Map

- 📂 [**`apps/`**](./apps) — Application entry points.
- 📂 [**`shared/`**](./shared) — Shared libraries (Compatibility engine, Hardware specs).
- 📂 [**`.github/`**](./.github) — CI/CD workflows and GitHub actions.
- 📄 [**`ROADMAP.md`**](./ROADMAP.md) — Product vision and future features.
- 📄 [**`docker-compose.yml`**](./docker-compose.yml) — Container definitions for deployment.

---

## 📚 Documentation Hub

For detailed guides, architecture maps, and developer workflows, see:

- 🗺️ [**Architecture Codemap**](./codemaps/architecture.md) — Core architecture, monorepo layout, and system relations.
- 🧠 [**Backend Layout & Routes**](./codemaps/backend.md) — Hono subrouters, database pool configs, and controllers.
- 🎨 [**Frontend State & Pages**](./codemaps/frontend.md) — React routing, active build context, and layout helpers.
- 🗄️ [**Data Models & Schemas**](./codemaps/data.md) — Database entity maps and shared Zod validation schemas.
- ⚙️ [**Catalog Ingestion Pipelines**](./docs/component_creation_pipelines.md) — Scraper aggregation, matching heuristics, and database sync.
- 📂 [**Curated Files Catalog**](./docs/project_files_catalog.md) — Reference index of the primary source files.

---

## 🔒 Security & Standards

- **Environment Variables:** Each application contains a `.env.example`. Copy these to `.env` and fill in the required secrets.
- **Type Safety:** We use shared types in [`shared/types.ts`](./shared/types.ts) to ensure the API and UI are always in sync.
- **Testing:** We prioritize testing core logic in `shared` and critical backend endpoints.
