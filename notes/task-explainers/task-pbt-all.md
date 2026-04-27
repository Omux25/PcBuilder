# Property-Based Tests — All 11 Optional Properties

## What was built

11 property-based tests using fast-check, covering every optional correctness property from the spec. These run alongside the regular unit tests as part of `bun test`.

---

## Files created

```
backend/src/__tests__/pbt/
├── compatibility.pbt.test.ts   — Tasks 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
├── auth.pbt.test.ts            — Task 5.1
├── prices.pbt.test.ts          — Task 6.2
├── validation.pbt.test.ts      — Task 7.2
├── logs.pbt.test.ts            — Task 7.4
└── tsconfig.json

backend/scraper/__tests__/
└── scraperIsolation.pbt.test.ts — Task 10.6
```

---

## Properties implemented

| Task | Property | What it checks |
|---|---|---|
| 2.2 | `socket_mismatch fires iff cpu.socket !== motherboard.socket` | Biconditional — fires exactly when sockets differ |
| 2.3 | `ram_type_mismatch fires iff ram_type not in supported_ram_types` | Biconditional — fires exactly when type unsupported |
| 2.4 | `ram_frequency_exceeded fires iff frequency > max_frequency` | Biconditional — fires exactly when exceeded |
| 2.5 | `total_tdp = sum of all non-null TDPs` | Arithmetic correctness |
| 2.5 | `recommended_psu = ceil(total_tdp * 1.2)` | Formula correctness |
| 2.6 | `psu_underpowered fires iff wattage < recommended` | Biconditional |
| 2.7 | `gpu_too_long fires iff gpu.length_mm > case.max_gpu_length_mm` | Biconditional |
| 5.1 | `any malformed/wrong-secret token → 401` | Security invariant |
| 5.1 | `valid token with correct secret → 200` | Auth correctness |
| 6.2 | `service passes through DB rows unchanged` | Sort is DB's responsibility |
| 7.2 | `missing required field → 400 for all categories` | Validation completeness |
| 7.4 | `invalid level/limit → 400` | Input validation |
| 10.6 | `session always completes even when fetch throws` | Error isolation |
| 10.6 | `session never throws regardless of error message` | Resilience |

---

## Bug found by fast-check

During the PBT run, fast-check discovered a **prototype pollution vulnerability** in `validate.ts`:

```
Counterexample: ["__proto__", " "]
```

Sending `{ "category": "__proto__" }` bypassed the category check because `"__proto__" in componentSchemas` is always `true` (it's on every object's prototype). This caused `componentSchemas["__proto__"]` to return `undefined`, crashing the server with an unhandled exception.

**Fix:** Changed `category in componentSchemas` → `Object.hasOwn(componentSchemas, category)` in `validate.ts`.

This is a real security fix — without it, a malicious request could crash the backend.

---

## How to run

```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun test src/__tests__/pbt/ scraper/__tests__/scraperIsolation.pbt.test.ts 2>&1"
```

Or as part of the full suite: `bun test` (runs all 229 tests).
