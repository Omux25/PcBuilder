# PC Builder — Team Notes

> A price comparator and compatibility checker for PC components in Morocco. Users pick parts, get instant compatibility feedback, and compare prices across Moroccan retailers. The platform does **not** sell anything — it redirects users to retailer websites.

**Team:** Salmane ELHJOUJI (backend) · Ghali KHARMOUDY (frontend)  
**School:** EMSI Orangers, Casablanca  
**Deadline:** May 11, 2026

---

## How to read these files

| Tool | How |
|---|---|
| **VS Code** | Open the `notes/` folder. All files are plain Markdown — they render in the preview panel (`Ctrl+Shift+V`). |
| **GitHub** | Browse directly in the repository. GitHub renders Markdown automatically. |
| **Obsidian** | Open the `notes/` folder as a vault. Internal links and backlinks work out of the box. |

---

## Roadmap

| File | What it contains |
|---|---|
| [roadmap.md](roadmap.md) | All tasks, their status, and what to work on next |

---

## Spec Documents

The original project specification (Cahier des Charges) written for EMSI Orangers. See [spec/README.md](spec/README.md) for how to regenerate the PDFs.

| File | Description |
|---|---|
| [spec/cahier_de_charge_v2.tex](spec/cahier_de_charge_v2.tex) | LaTeX source — version 2 (latest) |
| [spec/cahier_de_charge.tex](spec/cahier_de_charge.tex) | LaTeX source — version 1 |

---

## Guide

Reference and learning material — read these to understand the project.

| File | What it contains |
|---|---|
| [guide/stack.md](guide/stack.md) | Every technology choice and why it was made |
| [guide/architecture.md](guide/architecture.md) | Project structure, layers, API routes, middleware chain |
| [guide/database.md](guide/database.md) | All 5 database tables explained, how to run migrations |
| [guide/dev-setup.md](guide/dev-setup.md) | How to run the server, tests, and migrations locally |
| [guide/concepts.md](guide/concepts.md) | Plain-language explanations of every concept (JWT, Zod, TDP, etc.) |
| [guide/git-workflow.md](guide/git-workflow.md) | Commit conventions, branch rules, what's gitignored |

---

## Glossary

| File | What it contains |
|---|---|
| [glossary.md](glossary.md) | Alphabetical definitions of every technical term used in this project |

---

## Diagrams

PlantUML source files for all project diagrams. See [diagrams/README.md](diagrams/README.md) for the full index and instructions for regenerating PNGs.

| File | Type | What it shows |
|---|---|---|
| [diagrams/use_case.puml](diagrams/use_case.puml) | Use Case | Actors and all system use cases |
| [diagrams/class.puml](diagrams/class.puml) | Class | Domain model, services, scrapers, DTOs |
| [diagrams/activity.puml](diagrams/activity.puml) | Activity | Complete user flow |
| [diagrams/sequence_1_compatibility.puml](diagrams/sequence_1_compatibility.puml) | Sequence | Component selection and compatibility validation |
| [diagrams/sequence_2_price_comparison.puml](diagrams/sequence_2_price_comparison.puml) | Sequence | Price comparison and retailer redirect |
| [diagrams/sequence_3_admin.puml](diagrams/sequence_3_admin.puml) | Sequence | Admin login and component management |
| [diagrams/sequence_scraping.puml](diagrams/sequence_scraping.puml) | Sequence | Daily price scraping background process |

---

## Task Explainers

One file per completed task. Each file explains what was built, why it matters, and which files were created or changed — based on the actual code.

| File | Task | Track | Dev |
|---|---|---|---|
| [task-explainers/task-01-project-scaffolding.md](task-explainers/task-01-project-scaffolding.md) | Initialize project structure and database | Backend | Salmane |
| [task-explainers/task-02-compatibility-engine.md](task-explainers/task-02-compatibility-engine.md) | Implement the Compatibility Engine | Backend | Salmane |
| [task-explainers/task-03-compatibility-tests.md](task-explainers/task-03-compatibility-tests.md) | Checkpoint — all compatibility engine tests pass | Backend | Salmane |
| [task-explainers/task-04-zod-schemas-middleware.md](task-explainers/task-04-zod-schemas-middleware.md) | Zod validation schemas and middleware | Backend | Salmane |
| [task-explainers/task-05-jwt-auth.md](task-explainers/task-05-jwt-auth.md) | JWT authentication middleware and auth route | Backend | Salmane |
| [task-explainers/task-06-1-component-service.md](task-explainers/task-06-1-component-service.md) | Component Service (data access layer) | Backend | Salmane |
| [task-explainers/task-06-3-components-routes.md](task-explainers/task-06-3-components-routes.md) | Public component routes (GET /api/components) | Backend | Salmane |
| [task-explainers/task-06-4-prices-route.md](task-explainers/task-06-4-prices-route.md) | Prices route (GET /api/components/:id/prices) | Backend | Salmane |
| [task-explainers/task-06-5-compatibility-route.md](task-explainers/task-06-5-compatibility-route.md) | Compatibility route (POST /api/compatibility/validate) | Backend | Salmane |
| [task-explainers/task-07-1-admin-components-routes.md](task-explainers/task-07-1-admin-components-routes.md) | Admin component routes (POST/PUT/DELETE) | Backend | Salmane |

> New explainers are added here after each task is completed — never before.
