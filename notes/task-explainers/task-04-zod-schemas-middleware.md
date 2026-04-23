> Defined the validation rules for each component category using Zod, and built the middleware that applies those rules to incoming API requests before they reach the database.

**Track:** Backend · **Dev:** Salmane · **Status:** ✅ Done · **Files:** `backend/src/schemas/componentSchemas.ts`, `backend/src/middleware/validate.ts`

---

## What was built

### `componentSchemas.ts` — Zod schemas

One Zod schema per component category. Each schema defines which fields are required and what types they must be.

#### Base schema (shared by all categories)

```typescript
const baseSchema = z.object({
  name: z.string().min(1),      // required, at least 1 character
  brand: z.string().optional(), // optional
});
```

#### Per-category schemas

Each category extends the base and adds its own required fields:

```typescript
export const cpuSchema = baseSchema.extend({
  socket: z.string().min(1),  // required — e.g. "AM5", "LGA1700"
  tdp: z.number().optional(),
});

export const motherboardSchema = baseSchema.extend({
  socket: z.string().min(1),
  supported_ram_types: z.array(z.string().min(1)).min(1), // array, at least 1 item
  max_ram_frequency: z.number(),
  tdp: z.number().optional(),
});

export const ramSchema = baseSchema.extend({
  ram_type: z.enum(['DDR4', 'DDR5']), // only these two values allowed
  frequency_mhz: z.number(),
  tdp: z.number().optional(),
});

export const psuSchema = baseSchema.extend({
  wattage: z.number(), // required
});

export const caseSchema = baseSchema.extend({
  max_gpu_length_mm: z.number(), // required
});
```

#### Schema map

```typescript
export const componentSchemas = {
  cpu: cpuSchema,
  motherboard: motherboardSchema,
  gpu: gpuSchema,
  ram: ramSchema,
  storage: storageSchema,
  psu: psuSchema,
  case: caseSchema,
} as const;

export type ComponentCategory = keyof typeof componentSchemas;
// = 'cpu' | 'motherboard' | 'gpu' | 'ram' | 'storage' | 'psu' | 'case'
```

`as const` makes TypeScript infer the exact keys as a union type instead of just `string`.

### `validate.ts` — validation middleware

The middleware reads the `category` field from the request body, picks the matching schema, and validates the entire body.

```typescript
export async function validateComponent(c: Context, next: Next): Promise<Response | void> {
  // 1. Parse the JSON body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON', fields: [] } }, 400);
  }

  // 2. Read and validate the category field
  const category = body !== null && typeof body === 'object' && 'category' in body
    ? (body as Record<string, unknown>).category
    : undefined;

  if (typeof category !== 'string' || !(category in componentSchemas)) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: `Field 'category' is required and must be one of: cpu, motherboard, gpu, ram, storage, psu, case`,
        fields: ['category'],
      }
    }, 400);
  }

  // 3. Validate the body against the category's schema
  const schema = componentSchemas[category as ComponentCategory];
  const result = schema.safeParse(body);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.') || issue.message);
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields } }, 400);
  }

  // 4. Attach validated data and continue
  c.set('validatedBody', result.data);
  await next();
}
```

`safeParse()` never throws — it returns `{ success: true, data }` or `{ success: false, error }`. The `fields` array in the error response tells the client exactly which fields failed.

### Error response format

All validation errors follow this exact shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": ["socket", "ram_type"]
  }
}
```

### Middleware flow

```
POST /api/admin/components
  → authMiddleware      (checks JWT)
  → validateComponent   (checks body against Zod schema)
  → route handler       (inserts into database)
```

If `validateComponent` returns a 400 response, the route handler never runs.

### What the 19 tests cover

| Scenario | Expected result |
|---|---|
| Valid CPU body | Passes, `validatedBody` is set |
| CPU missing `socket` | HTTP 400, `fields: ['socket']` |
| RAM with `ram_type: 'DDR3'` | HTTP 400, `fields: ['ram_type']` |
| Unknown category | HTTP 400, `fields: ['category']` |
| Missing `category` field | HTTP 400, `fields: ['category']` |
| Invalid JSON body | HTTP 400 |
| All 7 categories with valid data | All pass |

---

## Why it matters

Without validation, a client could send `{ category: 'cpu', name: '' }` (empty name) or `{ category: 'ram', ram_type: 'DDR3' }` (invalid enum) and the data would reach the database. Zod catches these errors at the API boundary, before any database query runs, and returns a clear error message that tells the client exactly what to fix.

---

## Files involved

```
backend/
└── src/
    ├── schemas/
    │   └── componentSchemas.ts              ← created
    └── middleware/
        ├── validate.ts                      ← created
        └── __tests__/
            ├── validate.test.ts             ← created
            └── tsconfig.json               ← created
```
