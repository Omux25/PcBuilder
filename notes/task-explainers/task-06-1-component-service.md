> Built the data access layer for components — the only part of the codebase that talks to the database for component and price data.

**Track:** Backend · **Dev:** Salmane · **Status:** ✅ Done · **Files:** `backend/src/services/componentService.ts`

---

## What was built

Three exported functions that query the `components` and `prices` tables. Routes call these functions — they never query the database directly.

### Dependency injection pattern

The service uses a replaceable SQL executor so tests can run without a real database:

```typescript
import { sql as bunSql } from 'bun';

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

let _sql: SqlFn = bunSql as unknown as SqlFn; // real Bun.sql by default

export function setSql(mockSql: SqlFn): void { _sql = mockSql; }   // for tests
export function resetSql(): void { _sql = bunSql as unknown as SqlFn; } // restore
```

In tests: call `setSql(mockFn)` before the test, `resetSql()` in `afterEach`. The mock returns whatever the test needs. No PostgreSQL server required.

### Types

```typescript
export interface Component {
  id: number;
  name: string;
  brand?: string;
  category: string;
  socket?: string;
  supported_ram_types?: string[];
  max_ram_frequency?: number;
  ram_type?: string;
  frequency_mhz?: number;
  length_mm?: number;
  max_gpu_length_mm?: number;
  wattage?: number;
  tdp?: number;
  created_at: string;
  updated_at: string;
}

export interface PriceOffer {
  retailer_name: string;
  price: number;
  in_stock: boolean;
  product_url: string;
  last_updated: string;
}
```

### `getComponents(filters)` — list with optional filters

```typescript
async function getComponents(
  filters: { category?: string; socket?: string; ram_type?: string } = {}
): Promise<Component[]>
```

All three filters are optional. The WHERE clause is built by checking which filters are present:

| Filters provided | Query |
|---|---|
| None | `SELECT * FROM components ORDER BY id ASC` |
| `category` only | `WHERE category = $1` |
| `category` + `socket` | `WHERE category = $1 AND socket = $2` |
| `category` + `ram_type` | `WHERE category = $1 AND ram_type = $2` |
| `socket` + `ram_type` | `WHERE socket = $1 AND ram_type = $2` |
| All three | `WHERE category = $1 AND socket = $2 AND ram_type = $3` |

Each branch uses a Bun.sql template literal — all values are parameterized, never concatenated into the SQL string.

> **Why not build the WHERE clause dynamically with string concatenation?**  
> String concatenation in SQL is vulnerable to SQL injection. Bun.sql template literals always treat `${}` values as parameters, never as SQL code. Each branch is a separate, safe query.

### `getComponentById(id)` — single component

```typescript
async function getComponentById(id: number): Promise<Component>
```

Returns one component or throws a typed error:

```typescript
if (rows.length === 0) {
  const err = new Error(`Component with id ${id} not found`);
  (err as NodeJS.ErrnoException).code = 'COMPONENT_NOT_FOUND';
  throw err;
}
```

The route handler catches this error and checks `err.code === 'COMPONENT_NOT_FOUND'` to return HTTP 404. Using a `code` property instead of checking the error message string makes the check robust — the message can change without breaking the handler.

### `getPricesByComponentId(id)` — price offers sorted by price

```typescript
async function getPricesByComponentId(id: number): Promise<PriceOffer[]>
```

Joins `prices` and `retailers` to return price offers with retailer names, sorted cheapest first:

```typescript
return _sql`
  SELECT
    r.name        AS retailer_name,
    p.price,
    p.in_stock,
    p.product_url,
    p.last_updated
  FROM prices p
  JOIN retailers r ON r.id = p.retailer_id
  WHERE p.component_id = ${id}
  ORDER BY p.price ASC
`;
```

Without the JOIN, the result would only contain `retailer_id` (a number). The JOIN replaces that with `r.name` — the actual retailer name.

`ORDER BY p.price ASC` guarantees the cheapest offer is always first. The frontend can display them in order without sorting.

---

## Why it matters

This service is the single point of contact between the application and the database for component data. Routes don't write SQL — they call these functions. This means:

- SQL is in one place, easy to audit and change
- Routes stay simple and focused on HTTP concerns
- Tests can inject a mock SQL function and run without a database

---

## Files involved

```
backend/
└── src/
    └── services/
        ├── componentService.ts              ← created
        └── __tests__/
            ├── componentService.test.ts     ← created
            └── tsconfig.json               ← created
```
