> Implemented the public prices route that returns all retailer price offers for a component, sorted cheapest first.

**Track:** Backend · **Dev:** Salmane · **Status:** ✅ Done · **Files:** `backend/src/routes/prices.ts`

---

## What was built

### `GET /api/components/:id/prices`

Returns all price offers for a component joined with retailer data, sorted by ascending price.

```typescript
pricesRouter.get('/:id/prices', async (c) => {
  const id = Number(c.req.param('id'));

  // Validate ID
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: { code: 'VALIDATION_ERROR', ... } }, 400);
  }

  // Verify component exists — return 404 if not
  await getComponentById(id); // throws COMPONENT_NOT_FOUND if missing

  const offers = await getPricesByComponentId(id);

  if (offers.length === 0) {
    return c.json({ offers: [], message: 'This component is not available from any referenced retailer.' });
  }

  return c.json({ offers });
});
```

### Response shapes

**With offers:**
```json
{
  "offers": [
    {
      "retailer_name": "Retailer A",
      "price": 1299.99,
      "in_stock": true,
      "product_url": "https://retailer-a.ma/product/1",
      "last_updated": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**No offers:**
```json
{
  "offers": [],
  "message": "This component is not available from any referenced retailer."
}
```

### Response codes

| Scenario | Status |
|---|---|
| Offers found | 200 |
| No offers (component exists) | 200 with empty array + message |
| Component not found | 404 |
| ID not a positive integer | 400 |

---

## Why it matters

This is the price comparison feature — the second core value of the platform after compatibility checking. The frontend calls this route when a user clicks a component to see where to buy it cheapest.

---

## Files involved

```
backend/
└── src/
    └── routes/
        ├── prices.ts                  ← created
        └── __tests__/
            └── prices.test.ts         ← created
```
