# Compatibility Engine

The compatibility engine is the core feature of the platform. It takes a partial PC build and tells the user which parts are incompatible and why — before they spend money.

**File:** `backend/src/services/compatibilityService.ts`
**Route:** `POST /api/compatibility/validate`

---

## What it does

A user selects components one by one in the configurator. After each selection, the frontend calls the compatibility API with the current build. The engine checks all applicable rules and returns:

- **Errors** — hard incompatibilities. The build physically cannot work (e.g. CPU and motherboard have different sockets).
- **Warnings** — soft issues. The build will work but not optimally (e.g. RAM speed exceeds the motherboard's maximum).
- **TDP summary** — total power draw and recommended PSU wattage.

```json
{
  "compatible": false,
  "total_tdp": 380,
  "recommended_psu_wattage": 456,
  "errors": [
    {
      "rule": "socket_mismatch",
      "components": ["cpu", "motherboard"],
      "message": "CPU socket AM5 is not compatible with motherboard socket LGA1700"
    }
  ],
  "warnings": []
}
```

---

## The 8 rules

Rules only fire when **both** required components are present in the build. A partial build (e.g. only CPU selected) will not trigger socket_mismatch because there's no motherboard to compare against.

### Rule 1 — Socket mismatch (error)

**Applies to:** CPU + Motherboard

The CPU and motherboard must have the same socket. The socket is the physical connector — an AM5 CPU has a different pin layout than an LGA1700 CPU and will not physically fit in the wrong socket.

```
AM5 CPU  +  AM5 Motherboard   → compatible
AM5 CPU  +  LGA1700 Motherboard → socket_mismatch error
```

Common sockets:
- AMD: AM4 (Ryzen 3000/5000), AM5 (Ryzen 7000/9000)
- Intel: LGA1200 (10th/11th gen), LGA1700 (12th/13th/14th gen), LGA1851 (Core Ultra 200)

### Rule 2 — RAM type mismatch (error)

**Applies to:** RAM + Motherboard

The motherboard's `supported_ram_types` is an array (e.g. `['DDR5']`). If the RAM's `ram_type` is not in that array, the stick will not physically fit — DDR4 and DDR5 have different notch positions.

```
DDR5 RAM  +  DDR5 Motherboard  → compatible
DDR4 RAM  +  DDR5 Motherboard  → ram_type_mismatch error
```

### Rule 3 — RAM frequency exceeded (warning)

**Applies to:** RAM + Motherboard

This is a **warning**, not an error. If the RAM's rated frequency exceeds the motherboard's `max_ram_frequency`, the build will still work — the RAM will just run at the motherboard's maximum speed instead of its rated speed. The user is paying for performance they won't get.

```
DDR5-6000 RAM  +  Motherboard max 5600 MHz  → ram_frequency_exceeded warning
DDR5-5600 RAM  +  Motherboard max 5600 MHz  → no warning
```

### Rule 4 — GPU too long (error)

**Applies to:** GPU + Case

Physical clearance check. If the GPU's `length_mm` exceeds the case's `max_gpu_length_mm`, the GPU will not fit inside the case.

```
RTX 4090 (336mm)  +  Case max 400mm  → compatible
RTX 4090 (336mm)  +  Case max 300mm  → gpu_too_long error
```

### Rule 5 — TDP calculation (always runs)

**Applies to:** All components

The engine sums the TDP (Thermal Design Power) of every component in the build and calculates the minimum recommended PSU wattage with a 50% safety margin.

```
total_tdp = sum of all component TDPs
recommended_psu_wattage = ceil(total_tdp × 1.5)
```

The 50% margin exists because:
- PSUs degrade over time and lose efficiency
- Running a PSU at 100% capacity shortens its lifespan
- Power draw spikes during load can exceed the rated TDP

Typical TDP values:
| Component | Typical range |
|---|---|
| CPU | 65W – 253W |
| GPU | 100W – 450W |
| Motherboard | 10W – 80W |
| RAM (per stick) | 3W – 10W |
| Storage (NVMe) | 3W – 10W |
| Case fans | 2W – 5W each |

### Rule 6 — PSU underpowered (warning)

**Applies to:** PSU (uses recommended_psu_wattage from Rule 5)

If the selected PSU's wattage is below the recommended minimum, the build may be unstable under load. This is a warning because the system might still boot — but it risks random shutdowns or hardware damage.

```
Recommended: 456W  +  PSU 550W  → no warning
Recommended: 456W  +  PSU 450W  → psu_underpowered warning
```

### Rule 7 — Form factor mismatch (error)

**Applies to:** Motherboard + Case

The motherboard's form factor must be supported by the case. An ATX motherboard will not physically fit in a case that only supports mATX or Mini-ITX.

```
ATX Motherboard  +  ATX Mid Tower  → compatible
ATX Motherboard  +  Mini-ITX Case  → form_factor_mismatch error
```

The case's `supported_motherboards` field lists the accepted form factors (e.g. `["ATX", "mATX", "Mini-ITX"]`).

### Rule 8 — Cooler too tall (error)

**Applies to:** Cooling + Case

Air coolers have a height in mm. If the cooler is taller than the case's `max_cooler_height_mm`, it will not fit with the side panel on.

```
Noctua NH-D15 (165mm)  +  Case max 170mm  → compatible
Noctua NH-D15 (165mm)  +  Case max 155mm  → cooler_too_tall error
```

AIO liquid coolers are not affected by this rule — they mount to the case radiator slots, not inside the case.

---

## Errors vs warnings

| Type | Meaning | User action |
|---|---|---|
| Error | Build physically cannot work | Must change one of the conflicting components |
| Warning | Build works but not optimally | Should consider upgrading, but can proceed |

The `compatible` field in the response is `true` only when the `errors` array is empty. Warnings do not affect compatibility.

---

## How the frontend uses it

The `BuildSummary` component calls `POST /api/compatibility/validate` with a 300ms debounce every time the build changes. It uses an `AbortController` to cancel in-flight requests if a new one starts before the previous one completes.

Rule codes like `socket_mismatch` are mapped to human-readable French labels via `RULE_LABELS` in `frontend/src/types.ts` before being shown to the user.

---

## Testing

The compatibility engine has the most test coverage in the project — it's the most critical piece of logic.

**Unit tests** (`compatibilityService.test.ts`): one test per rule, covering the positive case (rule fires), negative case (rule doesn't fire), and edge cases (missing component, null TDP).

**Property-based tests** (fast-check): for each rule, a property is defined that must hold for all possible inputs. For example:

> "For any two socket strings, `socket_mismatch` fires if and only if the sockets are different."

fast-check generates hundreds of random socket string pairs to try to find a counterexample. If it finds one, the test fails and reports the minimal failing input.
