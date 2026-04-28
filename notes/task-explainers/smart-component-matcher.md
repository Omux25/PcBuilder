# Smart Component Matcher — DNA-Based Product Matching

## What problem does this solve?

The old auto-mapping scripts used a generic token-matching approach with a 70–85% threshold. This caused two types of failures:

1. **False positives** — "RTX 4070" matched "RTX 4080" because they share 90%+ of their tokens. In PC hardware, a single character difference means a completely different product and price.
2. **False negatives** — RAM titles like "Corsair Vengeance 2x16GB DDR5 6000MHz" failed to match because the kit notation `2x16GB` wasn't normalized to `32gb`.

Gemini's recommendation: stop comparing full strings and start extracting structured "DNA" tokens per category.

---

## What was built

### `backend/src/utils/componentMatcher.ts`

The core matching engine. It has three layers:

#### 1. Category-specific DNA extractors

Each category has a dedicated function that extracts the minimal set of tokens that uniquely identify a component:

| Category | DNA tokens extracted | Example |
|---|---|---|
| GPU | chipset model | `rtx4090`, `rx7900xtx` |
| CPU | family + model number | `ryzen5`, `7600x` |
| RAM | capacity + type + speed | `32gb`, `ddr5`, `6000` |
| Storage | capacity + interface | `2tb`, `nvme` |
| PSU | wattage + efficiency | `850w`, `gold` |
| Motherboard | chipset + socket | `b650e`, `am5` |
| Case | form factor + model tokens | `atx`, `4000d` |
| Cooling | type + size | `240mm`, `aio` |

#### 2. `scoreDnaMatch(productName, catalogName, category)`

Extracts DNA from the catalog name, then checks if ALL those tokens appear in the scraped product name. Returns a score 0–1.

The key insight: instead of comparing full strings, we compare the extracted "fingerprint". If the catalog entry is `"NVIDIA GeForce RTX 4090"`, its DNA is just `["rtx4090"]`. The product `"Gigabyte RTX 4090 GAMING OC 24G"` contains `rtx4090` → score = 1.0.

#### 3. Boundary matching for numeric tokens

The tricky part: `rtx4090` must match `"rtx 4090"` (with a space) but `rx7900xt` must NOT match `"rx7900xtx"` (which is a different product).

The solution uses a "semi-compact" form:
- `"rtx 4090 gaming"` → `"rtx4090 gaming"` (letter→digit spaces removed, digit→word spaces kept)
- This makes `rtx4090` a standalone word that can be matched exactly

For pure numeric tokens like `7600x`, the spaced normalized form already has it as a standalone word.

---

## How matching works in practice

```
Scraped: "MSI GeForce RTX 4070 Ti SUPER 16G"
Catalog: "NVIDIA GeForce RTX 4070 Ti"

DNA from catalog: ["rtx4070ti"]
Semi-compact product: "msi geforce rtx4070ti super 16g"
Token "rtx4070ti" found as substring → score = 1.0 ✓ MATCH
```

```
Scraped: "MSI GeForce RTX 4070 VENTUS 12G"
Catalog: "NVIDIA GeForce RTX 4080"

DNA from catalog: ["rtx4080"]
Semi-compact product: "msi geforce rtx4070 ventus 12g"
Token "rtx4080" NOT found → score = 0.0 ✗ NO MATCH
```

```
Scraped: "Corsair Vengeance 2x16GB DDR5 6000MHz"
Catalog: "Corsair Vengeance DDR5 32GB 6000MHz"

DNA from catalog: ["32gb", "ddr5", "6000"]
Kit notation: 2x16 → 32gb ✓
"ddr5" found ✓
"6000" found ✓
score = 1.0 ✓ MATCH
```

---

## Updated scripts

All three auto-map scripts now use `findBestMatch()` from `componentMatcher.ts`:

- `backend/scripts/auto_map_ultrapc.ts`
- `backend/scripts/auto_map_nextlevel.ts`
- `backend/scripts/auto_map_setupgame.ts`
- `backend/scripts/remap_all.ts` — runs all three + price aggregation + coverage report

For `case` and `cooling` categories, a partial match threshold of 0.8 is used (these categories have less critical model numbers).

---

## Running the remapper

```bash
# From WSL2
cd /mnt/c/Headquarters/Projects/PcBuilder/backend
~/.bun/bin/bun run scripts/remap_all.ts
```

This will:
1. Scrape all three retailers
2. Match products to catalog using DNA matching
3. Insert new mappings into `scraper_mappings`
4. Run price aggregation for newly matched products
5. Print a coverage report per category

---

## Tests

29 unit tests in `backend/src/utils/__tests__/componentMatcher.test.ts` covering:
- DNA extraction for all 8 categories
- False positive prevention (RTX 4070 ≠ RTX 4080, RX 7900 XTX ≠ RX 7900 XT, 7600X ≠ 7600)
- Kit notation normalization (2x16GB → 32gb)
- `findBestMatch` end-to-end matching
