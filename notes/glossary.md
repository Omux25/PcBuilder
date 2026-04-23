# Glossary

Plain-language definitions of every technical term used in this project. No assumed knowledge.

**Jump to:** [A](#a) · [B](#b) · [C](#c) · [D](#d) · [E](#e) · [F](#f) · [G](#g) · [H](#h) · [I](#i) · [J](#j) · [M](#m) · [N](#n) · [O](#o) · [P](#p) · [R](#r) · [S](#s) · [T](#t) · [U](#u) · [V](#v) · [W](#w) · [Z](#z)

---

## A

### API (Application Programming Interface)
A set of URLs that a server exposes so that other programs (or browsers) can talk to it. In this project, the backend exposes a REST API — for example, `GET /api/components` returns a list of PC components.

### `as const`
A TypeScript instruction that tells the compiler to treat an object or array as completely fixed — its values will never change and its keys are exact literal types. Used in `componentSchemas.ts` so that `ComponentCategory` is inferred as `'cpu' | 'motherboard' | 'gpu' | ...` instead of just `string`.

### ASC / DESC
SQL sort directions. `ORDER BY price ASC` = cheapest first. `ORDER BY price DESC` = most expensive first. Used in `getPricesByComponentId` to return price offers cheapest-first.

### Authentication
Proving who you are. In this project, admins prove their identity by sending a username and password to `POST /api/auth/login`. The server returns a JWT token that proves their identity for future requests.

### Authorization
Deciding what an authenticated person is allowed to do. In this project, only admins with a valid JWT token can call admin routes like `POST /api/admin/components`.

---

## B

### bcrypt
A password hashing algorithm. It transforms a plain-text password into a scrambled, irreversible string called a hash. In this project, admin passwords are stored as bcrypt hashes in the `admins` table — never as plain text. When an admin logs in, `bcrypt.compare(enteredPassword, storedHash)` returns `true` or `false` without ever reversing the hash.

Example:
```
"mypassword" → "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHy"
```

### Boolean
A value that is either `true` or `false`. In the `prices` table, `in_stock` is a boolean — a component is either in stock or it isn't.

### Bun
The JavaScript/TypeScript runtime used in this project. A runtime is the engine that executes your code. Bun is 3–4× faster than Node.js and includes a built-in SQL client (`Bun.sql`), test runner (`bun test`), and cron scheduler (`Bun.cron()`). Bun runs inside WSL2 on this project.

### `Bun.cron()`
A built-in Bun function for scheduling tasks on a time pattern (like "every day at midnight"). Used in the scraper scheduler to trigger price scraping every 24 hours. No external package needed.

### `Bun.sql`
A built-in PostgreSQL client in Bun. Used as a tagged template literal:
```typescript
const rows = await sql`SELECT * FROM components WHERE category = ${category}`;
```
The `${category}` is automatically treated as a parameter — never as raw SQL — which prevents SQL injection.

### `bun test`
The built-in test runner in Bun. It is Jest-compatible (same `test()`, `expect()`, `describe()` API). No external package needed. Tests run with `bun test` in WSL2.

---

## C

### CASCADE (ON DELETE CASCADE)
A database rule that says: "if the parent row is deleted, automatically delete all child rows too." In this project, `prices.component_id` has `ON DELETE CASCADE` — if a component is deleted from the `components` table, all its price entries in the `prices` table are deleted automatically.

### Category (component)
The type of PC part. This project supports exactly 7 categories:

| Category | Example |
|---|---|
| `cpu` | AMD Ryzen 7 7700X |
| `motherboard` | ASUS ROG Strix X670E |
| `gpu` | NVIDIA RTX 4070 |
| `ram` | Corsair Vengeance DDR5 |
| `storage` | Samsung 980 Pro SSD |
| `psu` | Seasonic Focus GX-850 |
| `case` | Fractal Design Meshify 2 |

### cheerio
A Node.js/Bun-compatible library for parsing HTML. Used in the scraper to extract prices and stock status from retailer web pages. Works like jQuery but on the server side.

### CHECK constraint
A database rule that rejects rows that don't satisfy a condition. In the `components` table: `CHECK (category IN ('cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case'))` — the database will refuse to insert a row with `category = 'keyboard'`.

### CommonJS (CJS)
The old module system for JavaScript: `const x = require('./x')` and `module.exports = x`. This project does **not** use CommonJS — it uses ESM instead.

### Compatibility Engine
The core business logic of this project. The function `validateCompatibility()` in `compatibilityService.ts` takes a partial PC build and checks 6 rules, returning errors (hard incompatibilities) and warnings (soft issues).

### Context (`c` in Hono)
The object passed to every Hono route handler and middleware. It holds the incoming request (`c.req`) and lets you build the response (`c.json()`). You can also attach custom data to it with `c.set('key', value)` and read it back with `c.get('key')`.

---

## D

### Data Access Layer
The part of the code that talks to the database. In this project, `componentService.ts` is the data access layer for components — routes call its functions, never the database directly. This separation makes the code easier to test.

### DDR4 / DDR5
RAM memory standards. DDR5 is newer and faster than DDR4. They are physically incompatible — a DDR5 stick will not fit in a DDR4 slot. The compatibility engine checks this via the `ram_type_mismatch` rule.

### Dependency Injection
A pattern where a function or class receives its dependencies from the outside instead of creating them itself. In `componentService.ts`, the SQL executor (`_sql`) can be replaced via `setSql(mockFn)` in tests. This means tests run without a real database.

### `describe()`
A `bun test` function that groups related tests together under a label. Makes test output easier to read.

```typescript
describe('socket_mismatch', () => {
  test('compatible sockets → no error', ...);
  test('incompatible sockets → error', ...);
});
```

---

## E

### Environment Variable
A value stored outside the code, in the operating system or a `.env` file. Used for secrets like `JWT_SECRET` and `DATABASE_URL`. Never committed to Git. The `.env.example` file shows which variables are needed without revealing their values.

### ESM (ES Modules)
The modern JavaScript module system: `import x from './x'` and `export default x`. This project uses ESM exclusively. The `"type": "module"` field in `package.json` enables it.

### `expect()`
A `bun test` function used to assert that a value matches what you expect. If it doesn't match, the test fails.

```typescript
expect(result.compatible).toBe(false);
// If result.compatible is true, the test fails and tells you exactly what was wrong.
```

---

## F

### `fast-check`
A property-based testing library. Instead of writing one test with one specific input, you define a property that must hold for all inputs, and `fast-check` generates hundreds of random inputs to try to break it. Used for optional property tests in this project.

### Foreign Key
A column in one table that references the primary key of another table. In the `prices` table, `component_id` is a foreign key referencing `components.id`. The database enforces that you can't insert a price for a component that doesn't exist.

---

## G

### GET
An HTTP method for reading data. `GET /api/components` returns a list of components. GET requests do not modify anything.

---

## H

### Hash / Hashing
A one-way transformation of data. You can hash a password, but you cannot reverse the hash to get the original password back. Used with bcrypt for storing admin passwords.

### Hono
The web framework used in this project. A framework provides tools for handling HTTP requests and routing. Hono is faster than Express and runs natively on Bun.

### HTTP
The protocol browsers and servers use to communicate. Every request has a method (GET, POST, PUT, DELETE) and a URL. Every response has a status code.

### HTTP Status Codes

| Code | Name | When we use it |
|---|---|---|
| `200` | OK | Request succeeded |
| `400` | Bad Request | Client sent invalid data (Zod validation failed) |
| `401` | Unauthorized | Missing, expired, or invalid JWT token |
| `404` | Not Found | Component ID doesn't exist |
| `500` | Internal Server Error | Unexpected server-side error |

---

## I

### Index (database)
A data structure that makes database queries faster. Without an index, finding all CPUs requires scanning every row in the `components` table. With `CREATE INDEX idx_components_category ON components (category)`, the database jumps directly to the matching rows.

### `INTEGER`
A SQL data type for whole numbers (no decimals). Used for `frequency_mhz`, `wattage`, `tdp`, etc.

---

## J

### JOIN
A SQL operation that combines rows from two tables based on a matching column. In `getPricesByComponentId`, a JOIN combines `prices` and `retailers` so the result includes the retailer's name instead of just its ID.

```sql
FROM prices p
JOIN retailers r ON r.id = p.retailer_id
```

### JWT (JSON Web Token)
A signed string that proves identity. Structure: `header.payload.signature`. The payload contains data like `{ id: 1, username: "admin" }`. The signature proves the token wasn't tampered with. In this project, admins receive a JWT after login and send it in the `Authorization: Bearer <token>` header on every protected request.

---

## M

### MAD (Moroccan Dirham)
The currency used for prices in this project. Prices are stored as `NUMERIC(10, 2)` — up to 10 digits with 2 decimal places (e.g. `1299.99`).

### Migration (database)
A SQL script that creates or modifies database tables. Migrations are numbered and run in order. This project has 5 migrations in `backend/src/db/migrations/`.

### Middleware
A function that runs between receiving an HTTP request and sending a response. It can inspect, modify, or reject the request. In this project:
- `authMiddleware` — checks the JWT token, rejects with 401 if invalid
- `validateComponent` — validates the request body with Zod, rejects with 400 if invalid

### Mock (in testing)
A fake replacement for a real dependency. In tests for `componentService.ts`, the real `Bun.sql` database connection is replaced with a mock function that returns whatever the test needs. This makes tests fast and independent of a real database.

---

## N

### `NOT NULL`
A SQL constraint that prevents a column from being empty. `name VARCHAR(255) NOT NULL` means every component must have a name.

### `NUMERIC(10, 2)`
A SQL data type for decimal numbers. `NUMERIC(10, 2)` allows up to 10 total digits with exactly 2 decimal places. Used for prices (e.g. `1299.99 MAD`).

---

## O

### `ON DELETE CASCADE`
See [CASCADE](#cascade-on-delete-cascade).

### `ORDER BY`
A SQL clause that sorts query results. `ORDER BY price ASC` = cheapest first. Used in `getPricesByComponentId` to return price offers sorted from cheapest to most expensive.

---

## P

### Parameterized Query
A SQL query where user-provided values are passed as separate parameters, never embedded directly in the SQL string. This prevents SQL injection. In this project, all queries use Bun.sql template literals which are always parameterized:
```typescript
// Safe — ${username} is a parameter, never raw SQL
const rows = await sql`SELECT * FROM admins WHERE username = ${username}`;
```

### Partial Index
A database index that only covers rows matching a condition. `CREATE INDEX idx_components_socket ON components (socket) WHERE socket IS NOT NULL` only indexes CPUs and Motherboards (the only categories with a socket), saving space.

### Polymorphic Table
A single database table that stores multiple types of entities. The `components` table stores all 7 component categories. Category-specific columns (like `socket` for CPUs, `wattage` for PSUs) are `NULL` when they don't apply to a given category.

### POST
An HTTP method for creating or submitting data. `POST /api/auth/login` submits credentials. `POST /api/compatibility/validate` submits a build for compatibility checking.

### PostgreSQL
The relational database used in this project. Stores all components, prices, retailers, admins, and scraper logs. Accessed via `Bun.sql`.

### Primary Key
A column (or set of columns) that uniquely identifies each row in a table. In this project, every table has `id SERIAL PRIMARY KEY` — an auto-incrementing integer.

### PSU (Power Supply Unit)
The component that provides power to all other components. The compatibility engine checks that the PSU's wattage is at least 120% of the total TDP of all components.

### PUT
An HTTP method for updating an existing resource. `PUT /api/admin/components/:id` updates a component.

---

## R

### React
The JavaScript library used for the frontend. It lets you build interactive UIs that update without reloading the page.

### `reduce()`
A JavaScript array method that iterates over an array and accumulates a single value. Used in the compatibility engine to sum all component TDPs:
```typescript
const total_tdp = componentKeys.reduce((sum, key) => {
  return sum + (build[key]?.tdp ?? 0);
}, 0);
```

### REST API
An API that uses standard HTTP methods (GET, POST, PUT, DELETE) and URLs to represent resources. `GET /api/components` = read components. `POST /api/admin/components` = create a component.

### Retailer
A Moroccan e-commerce website that sells PC components. Stored in the `retailers` table. The scraper visits retailer websites to collect prices.

### Route
A URL pattern + HTTP method that the server handles. `GET /api/components` is a route. In Hono, routes are defined with `app.get('/api/components', handler)`.

---

## S

### `safeParse()`
A Zod method that validates data without throwing an error. Returns `{ success: true, data }` on success or `{ success: false, error }` on failure. Used in `validateComponent` middleware.

### Schema (Zod)
A definition of what valid data looks like. `cpuSchema` says: a CPU must have a `name` (string) and a `socket` (string). If data doesn't match the schema, Zod returns a detailed error.

### `SERIAL`
A PostgreSQL shorthand for an auto-incrementing integer column. `id SERIAL PRIMARY KEY` means: automatically assign the next integer (1, 2, 3...) when a new row is inserted.

### Service
A module that contains business logic. Services don't know about HTTP or databases — they just take data in and return a result. In this project, `compatibilityService.ts` contains the 6 compatibility rules, and `componentService.ts` contains database queries for components.

### Socket (CPU/Motherboard)
The physical connector type on a CPU and motherboard. A CPU and motherboard must have the same socket to be compatible. Common sockets: `AM5` (AMD), `LGA1700` (Intel). The compatibility engine checks this via the `socket_mismatch` rule.

### SQL (Structured Query Language)
The language used to talk to relational databases. `SELECT`, `INSERT`, `UPDATE`, `DELETE` are SQL commands.

### SQL Injection
An attack where a malicious user sends SQL code as input to manipulate the database. Prevented by always using parameterized queries (never string concatenation in SQL).

### `TIMESTAMPTZ`
A PostgreSQL data type for a timestamp with timezone information. Used for `created_at`, `updated_at`, and `last_updated` columns.

### TypeScript
A superset of JavaScript that adds static types. Catches type errors before the code runs. All source files in this project use TypeScript (`.ts` extension).

---

## T

### Tagged Template Literal
A JavaScript feature where a function processes a template string. `Bun.sql` uses this:
```typescript
sql`SELECT * FROM components WHERE id = ${id}`
```
The backticks and `${}` syntax look like a regular template string, but `sql` processes it specially — it extracts the `${id}` value as a parameter instead of embedding it in the string.

### TDP (Thermal Design Power)
The maximum power a component consumes, measured in watts. Used to calculate the recommended PSU wattage. The compatibility engine sums all component TDPs and multiplies by 1.2 (20% safety margin).

### `test()`
A `bun test` function that defines a single test case. Takes a description string and a function that runs the test.

---

## U

### undici
A fast HTTP client library. Used in the scraper to fetch web pages from retailer websites. Bun-compatible.

### UNIQUE constraint
A database rule that prevents duplicate values in a column or combination of columns. `UNIQUE (component_id, retailer_id)` in the `prices` table means there can only be one price per (component, retailer) pair — the scraper updates the existing row instead of inserting a duplicate.

### UPSERT
A database operation that inserts a new row if it doesn't exist, or updates the existing row if it does. Used by the scraper to update prices:
```sql
INSERT INTO prices (...) VALUES (...)
ON CONFLICT (component_id, retailer_id)
DO UPDATE SET price = EXCLUDED.price, last_updated = NOW();
```

---

## V

### `VARCHAR(n)`
A SQL data type for variable-length strings, up to `n` characters. `VARCHAR(255)` for component names, `VARCHAR(50)` for category, etc.

### Vite
The build tool used for the React frontend. Compiles TypeScript and React JSX, serves the app during development, and bundles it for production.

---

## W

### WSL2 (Windows Subsystem for Linux 2)
A feature of Windows that runs a real Linux kernel inside Windows. Bun is installed in WSL2 (Ubuntu) because it works best on Linux. VS Code on Windows connects to the files, but all execution (running the server, running tests) happens inside WSL2.

---

## Z

### Zod
A TypeScript library for defining and validating data schemas. Used in this project to validate incoming API request bodies before they reach the database. Each component category has its own Zod schema in `componentSchemas.ts`.
