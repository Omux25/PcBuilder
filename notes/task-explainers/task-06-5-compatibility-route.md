> Implemented the public compatibility validation route that exposes the compatibility engine over HTTP.

**Track:** Backend · **Dev:** Salmane · **Status:** ✅ Done · **Files:** `backend/src/routes/compatibility.ts`

---

## What was built

### `POST /api/compatibility/validate`

Accepts a partial build object and returns the full compatibility result.

```typescript
compatibilityRouter.post('/validate', async (c) => {
  const body = await c.req.json();
  const result = validateCompatibility(body);
  return c.json(result);
});
```

### Request body

All fields are optional — send only the components you have selected:

```json
{
  "cpu":         { "socket": "AM5", "tdp": 105 },
  "motherboard": { "socket": "AM5", "supported_ram_types": ["DDR5"], "max_ram_frequency": 6000, "tdp": 15 },
  "gpu":         { "length_mm": 320, "tdp": 200 },
  "ram":         { "ram_type": "DDR5", "frequency_mhz": 5600, "tdp": 10 },
  "psu":         { "wattage": 850 },
  "case":        { "max_gpu_length_mm": 400 }
}
```

### Response

Always HTTP 200. The `compatible` flag tells you if the build has hard errors.

```json
{
  "compatible": false,
  "total_tdp": 330,
  "recommended_psu_wattage": 396,
  "errors": [
    {
      "rule": "socket_mismatch",
      "components": ["cpu", "motherboard"],
      "message": "CPU socket (AM5) is incompatible with motherboard socket (LGA1700)."
    }
  ],
  "warnings": []
}
```

### Response codes

| Scenario | Status |
|---|---|
| Any valid build (even empty) | 200 |
| Invalid JSON body | 400 |

---

## Why it matters

This route is called by the frontend every time the user adds or removes a component. It's the real-time feedback loop — the user selects a part and immediately sees if it's compatible with everything else in their build.

---

## Files involved

```
backend/
└── src/
    └── routes/
        ├── compatibility.ts               ← created
        └── __tests__/
            └── compatibility.test.ts      ← created
```
