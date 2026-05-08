# PENDING FIX — Timestamp display shows "à l'instant" incorrectly

> **DELETE THIS FILE once the fix is applied and verified.**

---

## Problem

In `apps/frontend/src/pages/ComponentDetail.tsx`, the `formatRelativeTime()` function
shows "à l'instant" for all price timestamps instead of the correct relative time
(e.g. "il y a 6h").

**Root cause:** `PriceOffer.last_updated` may arrive as a `Date` object (not a string)
depending on how Bun.sql serializes timestamps. Calling `new Date(dateObj)` on an
already-constructed `Date` object returns `Invalid Date` in some environments.
`Date.now() - NaN = NaN` → all comparisons fail → falls through to "à l'instant".

---

## Fix

In `apps/frontend/src/pages/ComponentDetail.tsx`, find `formatRelativeTime` and change:

```ts
// BEFORE
function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  ...
  if (minutes < 2) return "à l'instant";
  ...
}

// AFTER
function formatRelativeTime(dateStr: string | Date): string {
  const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  ...
  if (minutes < 2) return "à l'instant";
  ...
}
```

Also update the staleness check in the same file — same `new Date(mostRecent)` call
may have the same issue:

```ts
// Find this line:
const ageHours = (Date.now() - new Date(mostRecent).getTime()) / 3_600_000;

// Replace with:
const mostRecentDate = mostRecent instanceof Date ? mostRecent : new Date(mostRecent);
const ageHours = (Date.now() - mostRecentDate.getTime()) / 3_600_000;
```

---

## Affected file

`apps/frontend/src/pages/ComponentDetail.tsx` — `formatRelativeTime()` function
and the staleness warning block in the prices section.

---

## Verification

After fix: open any component detail page, check the "MIS À JOUR" column in the
prices table. Should show "il y a Xh" or "il y a Xj", not "à l'instant".
