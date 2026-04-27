> Implemented the three JWT-protected admin routes for creating, updating, and deleting components, and added the corresponding create/update/delete functions to the component service.

**Track:** Backend · **Dev:** Salmane · **Status:** ✅ Done · **Files:** `backend/src/routes/admin/components.ts`, `backend/src/services/componentService.ts`

---

## What was built

### Service additions (`componentService.ts`)

Three new functions added to the existing service:

| Function | SQL | Returns |
|---|---|---|
| `createComponent(data)` | `INSERT INTO components ... RETURNING *` | Created component |
| `updateComponent(id, data)` | `UPDATE components SET ... RETURNING *` | Updated component |
| `deleteComponent(id)` | `DELETE FROM components WHERE id = $1 RETURNING id` | void |

Both `updateComponent` and `deleteComponent` throw `COMPONENT_NOT_FOUND` if the row doesn't exist.

### Routes (`routes/admin/components.ts`)

All three routes are protected by `authMiddleware` applied at the router level:

```typescript
adminComponentsRouter.use('/*', authMiddleware);
```

This means every route in this file requires a valid JWT — no need to add it per-route.

#### `POST /api/admin/components`

```typescript
adminComponentsRouter.post('/', validateComponent, async (c) => {
  const data = c.get('validatedBody');
  const component = await createComponent(data);
  return c.json(component, 201);
});
```

Request flows: `authMiddleware` → `validateComponent` (Zod) → handler → DB insert → 201

#### `PUT /api/admin/components/:id`

```typescript
adminComponentsRouter.put('/:id', validateComponent, async (c) => {
  const id = Number(c.req.param('id'));
  const data = c.get('validatedBody');
  const component = await updateComponent(id, data);
  return c.json(component); // 200
});
```

#### `DELETE /api/admin/components/:id`

```typescript
adminComponentsRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await deleteComponent(id);
  return c.json({ message: `Component ${id} deleted successfully.` });
});
```

No Zod validation on DELETE — only the ID is needed.

### Response codes

| Route | Scenario | Status |
|---|---|---|
| POST | Created | 201 |
| POST | Missing/invalid field | 400 |
| POST | No/invalid token | 401 |
| PUT | Updated | 200 |
| PUT | Not found | 404 |
| PUT | Invalid ID or body | 400 |
| PUT | No/invalid token | 401 |
| DELETE | Deleted | 200 |
| DELETE | Not found | 404 |
| DELETE | Invalid ID | 400 |
| DELETE | No/invalid token | 401 |

---

## Why it matters

These routes are how the admin populates and maintains the component database. Without them, there's no way to add components for users to browse and compare.

---

## Files involved

```
backend/
└── src/
    ├── services/
    │   └── componentService.ts              ← modified (added create/update/delete)
    └── routes/
        └── admin/
            ├── components.ts                ← created
            └── __tests__/
                ├── components.test.ts       ← created
                └── tsconfig.json           ← created
```
