> Wrote 24 unit tests for the compatibility engine covering all 6 rules and their edge cases, and confirmed all tests pass.

**Track:** Backend · **Dev:** Salmane · **Status:** ✅ Done · **Files:** `backend/src/__tests__/compatibilityService.test.ts`

---

## What was built

A test file with 24 tests organized into `describe` blocks — one block per compatibility rule. Tests run with `bun test` inside WSL2.

### How to run

```bash
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun test 2>&1"
```

### Result

```
50 pass, 0 fail
114 expect() calls
Ran 50 tests across 3 files
```

### Test structure

Each test follows the Arrange → Assert pattern:

```typescript
test('AM5 CPU + LGA1700 motherboard → socket_mismatch error', () => {
  // Arrange — set up the data
  const result = validateCompatibility({
    cpu: { socket: 'AM5', tdp: 65 },
    motherboard: { socket: 'LGA1700', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, tdp: 15 },
  });

  // Assert — check the result
  expect(result.errors[0].rule).toBe('socket_mismatch');
  expect(result.compatible).toBe(false);
});
```

### What each describe block covers

| Block | Rule tested | Error or warning |
|---|---|---|
| `socket_mismatch` | CPU socket ≠ motherboard socket | Error |
| `ram_type_mismatch` | RAM type not in motherboard's supported list | Error |
| `ram_frequency_exceeded` | RAM frequency > motherboard max | Warning |
| `gpu_too_long` | GPU length > case max GPU length | Error |
| `tdp_calculation` | Total TDP sum + 20% margin | N/A (always runs) |
| `psu_underpowered` | PSU wattage < recommended | Warning |

### Edge cases covered

- Rules only fire when both required components are present (e.g. socket rule doesn't fire with only a CPU)
- Components with `null` or missing TDP contribute 0 to the total
- `compatible` is `true` only when the errors array is empty
- Warnings don't affect `compatible`
- `Math.ceil()` is applied to the recommended PSU wattage (e.g. `301 × 1.2 = 361.2 → 362`)

### Why test files are excluded from `tsconfig.json`

Test files import from `bun:test`:
```typescript
import { test, expect, describe } from 'bun:test';
```

`bun:test` is only available when running inside Bun (WSL2). VS Code's TypeScript server runs on Windows where Bun isn't installed. To prevent red squiggles in VS Code, test directories are excluded from the main `tsconfig.json`:

```json
"exclude": ["node_modules", "src/**/__tests__/**", "src/__tests__/**"]
```

The tests still run perfectly in WSL2 — this only affects the editor's type checking.

---

## Why it matters

Tests prove the compatibility engine behaves correctly for all 6 rules. Without tests, a future change to the engine could silently break a rule and users would get wrong compatibility results. The 24 tests act as a safety net — any regression is caught immediately.

---

## Files involved

```
backend/
└── src/
    └── __tests__/
        ├── compatibilityService.test.ts    ← created
        └── tsconfig.json                   ← created (excludes bun:test from VS Code)
```
