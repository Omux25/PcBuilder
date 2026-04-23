> Implemented the core business logic that checks whether a set of PC components are compatible with each other, returning hard errors and soft warnings.

**Track:** Backend · **Dev:** Salmane · **Status:** ✅ Done · **Files:** `backend/src/services/compatibilityService.ts`

---

## What was built

A single exported function, `validateCompatibility(build)`, that takes a partial PC build and applies 6 rules. "Partial" means not all 7 components need to be present — rules only run when both required components are in the build.

### Function signature

```typescript
function validateCompatibility(build: {
  cpu?:         { socket: string; tdp?: number | null };
  motherboard?: { socket: string; supported_ram_types: string[]; max_ram_frequency: number; tdp?: number | null };
  gpu?:         { length_mm: number; tdp?: number | null };
  ram?:         { ram_type: string; frequency_mhz: number; tdp?: number | null };
  storage?:     { tdp?: number | null };
  psu?:         { wattage: number; tdp?: number | null };
  case?:        { max_gpu_length_mm: number; tdp?: number | null };
})
```

Every component is optional (`?`). Rules only fire when both required components are present.

### Return value

```typescript
{
  compatible: boolean,              // true only if errors array is empty
  total_tdp: number,                // sum of all component TDPs
  recommended_psu_wattage: number,  // Math.ceil(total_tdp * 1.2)
  errors: Array<{ rule, components, message }>,   // hard incompatibilities
  warnings: Array<{ rule, components, message }>, // soft issues
}
```

### The 6 rules

#### Rule 1 — `socket_mismatch` (error)

```typescript
if (cpu && motherboard) {
  if (cpu.socket !== motherboard.socket) {
    errors.push({ rule: 'socket_mismatch', components: ['cpu', 'motherboard'], message: '...' });
  }
}
```

CPU and motherboard must have the same socket. AM5 CPU + LGA1700 motherboard = they physically don't connect.

#### Rule 2 — `ram_type_mismatch` (error)

```typescript
if (ram && motherboard) {
  if (!motherboard.supported_ram_types.includes(ram.ram_type)) {
    errors.push({ rule: 'ram_type_mismatch', ... });
  }
}
```

The motherboard's `supported_ram_types` is an array (e.g. `['DDR5']`). If the RAM's `ram_type` is not in that array, it's incompatible.

#### Rule 3 — `ram_frequency_exceeded` (warning)

```typescript
if (ram && motherboard) {
  if (ram.frequency_mhz > motherboard.max_ram_frequency) {
    warnings.push({ rule: 'ram_frequency_exceeded', ... });
  }
}
```

This is a **warning**, not an error. The build will work — the RAM will just run at the motherboard's maximum frequency instead of its rated speed.

#### Rule 4 — `gpu_too_long` (error)

```typescript
if (gpu && pcCase) {
  if (gpu.length_mm > pcCase.max_gpu_length_mm) {
    errors.push({ rule: 'gpu_too_long', ... });
  }
}
```

Physical clearance check. If the GPU is 420 mm and the case only fits 400 mm, the GPU won't fit.

#### Rule 5 — TDP calculation (always runs)

```typescript
const componentKeys = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case'] as const;
const total_tdp = componentKeys.reduce((sum, key) => {
  const component = build[key];
  return sum + (component && component.tdp != null ? component.tdp : 0);
}, 0);

const recommended_psu_wattage = Math.ceil(total_tdp * 1.2);
```

`reduce()` iterates over all 7 keys and sums their TDP values. Components without a TDP (or with `null`) contribute 0. The 20% margin (`× 1.2`) is a safety buffer — PSUs degrade over time and shouldn't run at 100% capacity.

#### Rule 6 — `psu_underpowered` (warning)

```typescript
if (psu) {
  if (psu.wattage < recommended_psu_wattage) {
    warnings.push({ rule: 'psu_underpowered', ... });
  }
}
```

Warning because the build might still work, but the PSU is running dangerously close to its limit.

### Errors vs warnings

| Type | Meaning | Example |
|---|---|---|
| Error | Build physically cannot work | AM5 CPU + LGA1700 motherboard |
| Warning | Build will work but not optimally | 500W PSU with 480W recommended draw |

---

## Why it matters

This is the core value proposition of the platform. Without it, the app is just a price list. The compatibility engine is what makes it useful — users can build a PC and know immediately if the parts work together before spending money.

The function is a pure service — it has no knowledge of HTTP, databases, or middleware. This makes it trivial to test in isolation and reuse from any route.

---

## Files involved

```
backend/
└── src/
    └── services/
        └── compatibilityService.ts    ← created
```
