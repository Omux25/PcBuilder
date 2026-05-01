# Task Explainers

This directory contains explainers for completed implementation tasks. Each file explains what was built, why, and how it works — written for someone who wasn't there when it was done.

---

## Index

| File | Task | What it covers |
|---|---|---|
| [task-cleanup-codebase-audit.md](task-cleanup-codebase-audit.md) | Codebase Cleanup — Audit Round 1 | 13 bugs fixed: dead code, migration numbering, DI bypass, scraper registry IDs, broken transaction wrapper, missing UI labels, doc inaccuracies |
| [task-cleanup-codebase-audit-round2.md](task-cleanup-codebase-audit-round2.md) | Codebase Cleanup — Audit Round 2 | 9 bugs fixed: compatibility rules 5 & 6 silently dead, PSU TDP inflation, non-transactional preset creation, LIKE token injection, duplicated ID validation, duplicate SQL query, placeholder scraper files, stale .gitkeep files |
| [task-cleanup-codebase-audit-round3.md](task-cleanup-codebase-audit-round3.md) | Codebase Cleanup — Audit Round 3 | 10 fixes: duplicate getRetailers query, bulk import coercion gaps, case TDP fix, stale .gitkeep files, migration count in docs, cookie helper, Vite boilerplate assets, ScraperLog interface placement, dynamic import, ScraperInstance interface |
| [task-cleanup-codebase-audit-round5.md](task-cleanup-codebase-audit-round5.md) | Codebase Cleanup — Audit Round 5 | 6 fixes: dead BuildSummary component, stale .gitkeep and empty sql/ dir, login input length caps, Zod validation on compatibility route, 38 new tests, flaky rate limiter test |
| [task-cleanup-codebase-audit-round7.md](task-cleanup-codebase-audit-round7.md) | Codebase Cleanup — Audit Round 7 | 10 fixes: injectable clock for rate limiter test, parseId() in presets route, removed duplicate setSql re-exports, dashboard auth middleware pattern, NaN guard in marketTrends, supported_motherboards CSV coercion, pinned deps, doc fixes (table count, bulk import response shape) |
| [task-cleanup-codebase-audit-round8.md](task-cleanup-codebase-audit-round8.md) | Codebase Cleanup — Audit Round 8 | 8 fixes: 4 wrong admin API return types, removed defensive workarounds in Scrapers/Unmatched pages, removed redundant setSql re-exports from 4 services + updated 6 test files, removed duplicate UltraPC DDR4 category URL, fixed footer retailer links, deleted empty packages/ dir, deleted scratch files from .kiro/specs/gemini/ |

---

## How to add an explainer

After completing a task:

1. Create a new file: `notes/task-explainers/task-XX-short-name.md`
2. Add it to the index table above
3. Link it from `notes/README.md` under the relevant section

### Template

```markdown
# Task XX — Short Name

**What was built:** One sentence.

**Why:** The problem this solves.

**How it works:** Step-by-step explanation with code snippets.

**Files changed:**
- `path/to/file.ts` — what changed and why

**Tests added:**
- `path/to/test.ts` — what the tests verify
```
