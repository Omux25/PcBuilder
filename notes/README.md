# PC Builder Maroc — Documentation

> A price comparator and compatibility checker for PC components in Morocco.
> Users pick parts, get instant compatibility feedback, and compare prices across Moroccan retailers.
> The platform does **not** sell anything — it redirects users to retailer websites.

**Team:** Salmane ELHJOUJI (backend) · Ghali KHARMOUDY (frontend)
**School:** EMSI Orangers, Casablanca · **Deadline:** May 11, 2026
**Status:** Complete — all tests passing

---

## Start here

If you're new to the project, read in this order:

1. [What the platform does and how it's built](features/compatibility-engine.md) — start with the core feature
2. [How to run everything locally](reference/dev-setup.md) — get the stack running
3. [API reference](reference/api.md) — all endpoints in one place
4. [Database schema](reference/database.md) — all 13 tables explained

---

## Guide

How-to guides for working with the codebase — architecture decisions, key concepts, and the database schema.

| File | What it covers |
|---|---|
| [guide/architecture.md](guide/architecture.md) | Directory structure, API routes table, request lifecycle, DI pattern |
| [guide/concepts.md](guide/concepts.md) | Compatibility rules, DNA matching, variant model, scraper registry |
| [guide/database.md](guide/database.md) | Schema overview, category/column table, design decisions |

---

## Features

How each major feature works — the what, why, and how.

| File | What it covers |
|---|---|
| [features/compatibility-engine.md](features/compatibility-engine.md) | The 8 compatibility rules, how errors vs warnings work, TDP calculation |
| [features/price-comparison.md](features/price-comparison.md) | Price offers, variant model, price history, how the scraper feeds the UI |
| [features/scraping-system.md](features/scraping-system.md) | How scrapers work, the DNA matcher, aggregator, scheduler |
| [features/authentication.md](features/authentication.md) | JWT access tokens, refresh tokens, rate limiting, bcrypt |
| [features/component-catalog.md](features/component-catalog.md) | Categories, Zod schemas, slugs, search, pagination |
| [features/admin-panel.md](features/admin-panel.md) | Dashboard, component CRUD, bulk import, unmatched listings |

---

## Reference

Precise technical reference — look things up here.

| File | What it covers |
|---|---|
| [reference/api.md](reference/api.md) | Every API route — method, URL, params, response shape |
| [reference/database.md](reference/database.md) | All 13 tables, columns, constraints, indexes |
| [reference/dev-setup.md](reference/dev-setup.md) | Prerequisites, migrations, running the stack, running tests |
| [reference/stack.md](reference/stack.md) | Every technology choice and why it was made |

---

## Task Explainers

Per-task explainers added after each completed implementation task.

| File | What it covers |
|---|---|
| [task-explainers/README.md](task-explainers/README.md) | Index of all explainers |
| [task-explainers/task-cleanup-codebase-audit.md](task-explainers/task-cleanup-codebase-audit.md) | Codebase cleanup — 13 bugs fixed (Round 1) |
| [task-explainers/task-cleanup-codebase-audit-round2.md](task-explainers/task-cleanup-codebase-audit-round2.md) | Codebase cleanup — 9 bugs fixed (Round 2) |
| [task-explainers/task-cleanup-codebase-audit-round3.md](task-explainers/task-cleanup-codebase-audit-round3.md) | Codebase cleanup — 10 fixes (Round 3) |
| [task-explainers/task-cleanup-codebase-audit-round5.md](task-explainers/task-cleanup-codebase-audit-round5.md) | Codebase cleanup — 6 fixes (Round 5) |
| [task-explainers/task-cleanup-codebase-audit-round7.md](task-explainers/task-cleanup-codebase-audit-round7.md) | Codebase cleanup — 10 fixes (Round 7) |
| [task-explainers/task-cleanup-codebase-audit-round8.md](task-explainers/task-cleanup-codebase-audit-round8.md) | Codebase cleanup — 8 fixes (Round 8) |

---

## Diagrams

PlantUML source files — committed to Git. Rendered PNGs are in `diagrams/rendered/` (gitignored).

| File | Type | What it shows |
|---|---|---|
| [diagrams/use_case.puml](diagrams/use_case.puml) | Use Case | Actors and all system use cases |
| [diagrams/class.puml](diagrams/class.puml) | Class | Domain model, services, scrapers |
| [diagrams/activity.puml](diagrams/activity.puml) | Activity | Complete user flow |
| [diagrams/sequence_1_compatibility.puml](diagrams/sequence_1_compatibility.puml) | Sequence | Compatibility validation flow |
| [diagrams/sequence_2_price_comparison.puml](diagrams/sequence_2_price_comparison.puml) | Sequence | Price comparison and retailer redirect |
| [diagrams/sequence_3_admin.puml](diagrams/sequence_3_admin.puml) | Sequence | Admin login and component management |
| [diagrams/sequence_scraping.puml](diagrams/sequence_scraping.puml) | Sequence | Daily price scraping background process |

To regenerate PNGs:
```bash
java -DPLANTUML_LIMIT_SIZE=8192 -jar plantuml.jar -tpng notes/diagrams/*.puml -o rendered
```

---

## Glossary

[glossary.md](glossary.md) — Key terms and definitions used throughout the codebase.

---

## Spec Documents

The original project specification (Cahier des Charges) for EMSI Orangers.

| File | Description |
|---|---|
| [spec/cahier_de_charge_v2.tex](spec/cahier_de_charge_v2.tex) | LaTeX source — version 2 (latest) |
| [spec/cahier_de_charge.tex](spec/cahier_de_charge.tex) | LaTeX source — version 1 |

---

## Project status

See [roadmap.md](roadmap.md) for the full task history and what was built in each phase.
