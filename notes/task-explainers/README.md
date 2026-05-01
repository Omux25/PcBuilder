# Task Explainers

This directory contains explainers for completed implementation tasks. Each file explains what was built, why, and how it works — written for someone who wasn't there when it was done.

---

## Index

| File | Task | What it covers |
|---|---|---|
| [task-cleanup-codebase-audit.md](task-cleanup-codebase-audit.md) | Codebase Cleanup — Audit Round 1 | 13 bugs fixed: dead code, migration numbering, DI bypass, scraper registry IDs, broken transaction wrapper, missing UI labels, doc inaccuracies |

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
