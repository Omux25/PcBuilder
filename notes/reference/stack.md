# Tech Stack

Every technology choice in this project and why it was made.

---

## Overview

| Layer | Technology | Why |
|---|---|---|
| Runtime | Bun 1.3+ (in WSL2) | 3-4x faster than Node.js, built-in SQL/test/cron |
| Backend framework | Hono | TypeScript-first, faster than Express, runs on Bun |
| Database | PostgreSQL 16 | Arrays, JSONB, robust constraints |
| DB client | Bun.sql (built-in) | No extra package, auto-parameterized queries |
| Validation | Zod | Runtime type checking with TypeScript inference |
| Auth | JWT + bcrypt | Stateless tokens, one-way password hashing |
| Scraping | undici + cheerio | Fast HTTP client + jQuery-like HTML parsing |
| Scheduler | Bun.cron() (built-in) | No extra package needed |
| Testing | bun test (built-in) | Jest-compatible, no configuration |
| Property testing | fast-check | Generates hundreds of random inputs per property |
| Frontend | React 19 + Vite 6 | Component model, fast dev server |
| Charts | Recharts | React-native chart library |
| Routing | react-router-dom v6 | Client-side routing for SPA |
| Language | TypeScript (ESNext) | Catches type errors at compile time |

---

## Runtime: Bun inside WSL2

Bun is a JavaScript/TypeScript runtime — the engine that executes your code. Like Node.js, but faster and with more built-in tools.

**Why Bun over Node.js:**
- 3–4× faster execution
- Built-in TypeScript support — no `ts-node` or build step needed
- Built-in SQL client (`Bun.sql`) — no `pg` package needed
- Built-in test runner (`bun test`) — no Jest needed
- Built-in cron scheduler (`Bun.cron()`) — no `node-cron` needed

**Why WSL2:** Bun runs best on Linux. WSL2 runs a real Linux kernel inside Windows. Bun is installed in Ubuntu inside WSL2. VS Code on Windows connects to the files, but all execution happens in Linux.

> Never run Bun commands directly in PowerShell. Always use WSL2.

---

## Backend: Hono

A web framework for handling HTTP requests and routing.

**Why Hono over Express:**
- 2–3× faster than Express
- TypeScript-first — full type safety out of the box
- Runs natively on Bun (Express was built for Node.js)
- Built-in CORS middleware (`hono/cors`)
- Built-in static file serving (`hono/bun`)

---

## Database: PostgreSQL + Bun.sql

**Why PostgreSQL:**
- Supports arrays natively (`VARCHAR(20)[]`) — used for `supported_ram_types`
- JSONB for flexible spec storage per component category
- Robust foreign keys, constraints, and partial indexes
- `NUMERIC(10,2)` for precise price storage (no floating-point errors)

**Why Bun.sql over pg/node-postgres:**
- Built into Bun — no extra package
- Tagged template literal syntax prevents SQL injection automatically
- Zero configuration

```typescript
// Always parameterized — ${category} is never raw SQL
const rows = await sql`SELECT * FROM components WHERE category = ${category}`;
```

---

## Validation: Zod

Defines data schemas in TypeScript that are checked at runtime. When a request arrives, Zod validates it before any database query runs.

**Why Zod over manual validation:**
- Schemas are TypeScript types — no duplication between runtime checks and type annotations
- Errors include the exact field names that failed
- `safeParse()` returns a result object instead of throwing — easy to handle in middleware

---

## Auth: JWT + bcrypt

**JWT** — stateless authentication. The server signs a 15-minute access token on login. The client sends it on every protected request. No session storage needed on the server.

**Refresh tokens** — 7-day UUID stored as an HttpOnly cookie. Automatically refreshed by the admin panel client.

**bcrypt** — one-way password hashing. Passwords are never stored in plain text. Even if the database is stolen, hashes cannot be reversed.

---

## Scraping: undici + cheerio

**undici** — fast HTTP client for fetching retailer web pages. Bun-compatible. Used instead of the built-in `fetch` for better performance and connection pooling.

**cheerio** — parses HTML and provides a jQuery-like API for extracting data. Runs on the server side.

**Why not Crawlee/Puppeteer:**
- Crawlee is Node.js only — incompatible with Bun
- Puppeteer launches a full browser — overkill for simple price extraction from static HTML
- Moroccan retailer sites don't require JavaScript rendering for product listings

---

## Testing: bun test + fast-check

**bun test** — Jest-compatible test runner built into Bun. Same `test()`, `expect()`, `describe()` API. No configuration needed. Runs 324 tests in ~4 seconds.

**fast-check** — property-based testing. Instead of one test with one specific input, you define a property that must hold for all inputs. fast-check generates hundreds of random inputs to try to find a counterexample.

Example: the property "socket_mismatch fires if and only if cpu.socket !== motherboard.socket" is tested with hundreds of random socket string pairs. This caught a real bug — the property failed when both sockets were empty strings.

---

## Frontend: React + Vite

**React 19** — component model for building interactive UIs. State lives in `App.tsx` and flows down to child components.

**Vite 6** — fast dev server with hot module replacement. Proxies `/api` requests to the backend in development — no CORS issues, no hardcoded ports.

**react-router-dom v6** — client-side routing. Routes: `/` (configurator), `/components/:slug` (detail page).

**Recharts** — React-native chart library for the price history chart and admin dashboard bar chart.

---

## Language: TypeScript with ESM

All source files use `.ts` or `.tsx`. Bun transpiles TypeScript natively — no `tsc` build step needed.

ESM (`import`/`export`) is used throughout. `"type": "module"` in `package.json` enables it. CommonJS (`require`) is never used.

Import paths use `.js` extensions even for `.ts` files — this is required for ESM compatibility with Bun's module resolution.
