# Tech Stack

Every technology choice in this project, and why it was chosen over the alternatives.

## Overview

| Layer | Technology | Version |
|---|---|---|
| Runtime | Bun (in WSL2) | 1.3.13 |
| Backend framework | Hono | 4.12.12 |
| Database | PostgreSQL | 16 |
| DB client | Bun.sql (built-in) | — |
| Validation | Zod | 4.3.6 |
| Auth | JWT + bcrypt | jsonwebtoken 9.0.2, bcrypt 6.0.0 |
| Scraping | cheerio + undici | cheerio 1.0.0, undici 8.1.0 |
| Scheduler | Bun.cron() (built-in) | — |
| Testing | bun test (built-in) | — |
| Property testing | fast-check | 4.7.0 |
| Language | TypeScript | ESNext |
| Frontend framework | React + Vite | React 19, Vite 8 |

---

## Runtime: Bun inside WSL2

**What it is:** Bun is a JavaScript/TypeScript runtime — the engine that executes your code. Like Node.js, but faster and with more built-in tools.

**Why Bun over Node.js:**
- 3–4× faster execution
- Built-in TypeScript support — no `ts-node` or build step needed
- Built-in SQL client (`Bun.sql`) — no `pg` package needed
- Built-in test runner (`bun test`) — no Jest needed
- Built-in cron scheduler (`Bun.cron()`) — no `node-cron` needed

**Why WSL2:** Bun runs best on Linux. WSL2 (Windows Subsystem for Linux) runs a real Linux kernel inside Windows. Bun is installed in Ubuntu inside WSL2. VS Code on Windows connects to the files, but all execution happens in Linux.

> **Never run Bun commands directly in PowerShell.** Always use WSL2. See [dev-setup.md](dev-setup.md) for the exact commands.

---

## Backend Framework: Hono

**What it is:** A web framework for handling HTTP requests and routing.

**Why Hono over Express:**
- 2–3× faster than Express
- TypeScript-first — full type safety out of the box
- Runs natively on Bun (Express was built for Node.js)
- Smaller API surface — easier to learn

**How it's used:** Every API route is defined with `app.get()`, `app.post()`, etc. Middleware (auth, validation) is attached per-route or globally.

---

## Database: PostgreSQL + Bun.sql

**Why PostgreSQL:**
- Supports arrays natively (`VARCHAR(20)[]`) — used for `supported_ram_types`
- Robust foreign keys and constraints
- `NUMERIC(10,2)` for precise price storage
- Partial indexes for performance

**Why Bun.sql over pg/node-postgres:**
- Built into Bun — no extra package
- Tagged template literal syntax prevents SQL injection automatically
- Same performance, zero configuration

```typescript
// Bun.sql — always parameterized, never injectable
const rows = await sql`SELECT * FROM components WHERE category = ${category}`;
```

---

## Validation: Zod

**Why Zod:** Defines data schemas in TypeScript that are checked at runtime. When a request arrives, Zod validates it before any database query runs. Errors include the exact field names that failed.

**Alternative considered:** Manual validation with `if` statements — rejected because it's verbose, error-prone, and doesn't give TypeScript type inference.

---

## Auth: JWT + bcrypt

**JWT** — stateless authentication. The server signs a token on login; the client sends it on every protected request. No session storage needed.

**bcrypt** — one-way password hashing. Passwords are never stored in plain text. Even if the database is compromised, hashes cannot be reversed.

---

## Scraping: cheerio + undici

**undici** — fast HTTP client for fetching retailer web pages. Bun-compatible.

**cheerio** — parses HTML and provides a jQuery-like API for extracting data. Runs on the server side.

**Why not Crawlee/Puppeteer:** Crawlee is Node.js only. Puppeteer launches a full browser — overkill for simple price extraction from static HTML.

---

## Scheduler: Bun.cron()

Built into Bun 1.3+. Triggers the scraping session every 24 hours using a standard cron expression (`0 0 * * *`). No external package needed.

---

## Testing: bun test + fast-check

**bun test** — Jest-compatible test runner built into Bun. Same `test()`, `expect()`, `describe()` API. No configuration needed.

**fast-check** — property-based testing. Instead of one test with one input, you define a property that must hold for all inputs and fast-check generates hundreds of random cases to try to break it.

---

## Language: TypeScript with ESM

All source files use `.ts`. Bun transpiles TypeScript natively — no `tsc` build step.

ESM (`import`/`export`) is used throughout. `"type": "module"` in `package.json` enables it. CommonJS (`require`) is never used.
