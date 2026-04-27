> Implemented the two public component listing routes that let the frontend fetch components from the database with optional filters.

**Track:** Backend · **Dev:** Salmane · **Status:** ✅ Done · **Files:** `backend/src/routes/components.ts`

---

## What was built

Two GET routes on a Hono router, both wired to the existing `componentService` functions.

### `GET /api/components`

Returns all components. Accepts three optional query parameters:

| Parameter | Type | Example | Effect |
|---|---|---|---|
| `category` | string | `?category=cpu` | Filter by component type |
| `socket` | string | `?socket=AM5` | Filter by socket type |
| `ram_type` | string | `?ram_type=DDR5` | Filter by RAM type |

Parameters can be combined: `?category=cpu&socket=AM5`

```typescript
componentsRouter.get('/', async (c) => {
  const category = c.req.query('category');
  const socket   = c.req.query('socket');
  const ram_type = c.req.query('ram_type');

  const components = await getComponents({ category, socket, ram_type });
  return c.json(components);
});
```

`c.req.query()` returns `undefined` if the parameter is absent. `getComponents` treats `undefined` filters as "no filter" and returns all components.

### `GET /api/components/:id`

Returns a single component by its database ID.

```typescript
componentsRouter.get('/:id', async (c) => {
  const raw = c.req.param('id');
  const id  = Number(raw);

  if (!Number.isInteger(id) || id <= 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } },
      400,
    );
  }

  try {
    const component = await getComponentById(id);
    return c.json(component);
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'COMPONENT_NOT_FOUND') {
      return c.json({ error: { code: 'NOT_FOUND', message: err.message } }, 404);
    }
    throw err;
  }
});
```

### Response codes

| Scenario | Status |
|---|---|
| Components found | 200 |
| No components match filters | 200 with empty array `[]` |
| Component found by ID | 200 |
| ID is not a positive integer | 400 |
| Component not found by ID | 404 |

### Error response shape

```json
{ "error": { "code": "NOT_FOUND", "message": "Component with id 999 not found" } }
```

---

## Why it matters

This is the first public-facing API surface. The frontend calls `GET /api/components?category=cpu` to populate the component picker, and `GET /api/components/:id` to load a component's detail page. Without these routes, the frontend has no way to get component data.

---

## Files involved

```
backend/
└── src/
    └── routes/
        ├── components.ts              ← created
        └── __tests__/
            ├── components.test.ts     ← created
            └── tsconfig.json         ← created
```
