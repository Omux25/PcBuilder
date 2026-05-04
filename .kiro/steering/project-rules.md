---
inclusion: always
---

# PC Builder Project — Steering Rules

These rules capture all behaviors, preferences, and decisions established during this project. Apply them to every interaction.

---

## Language

- All code, comments, variable names, file names, and documentation must be in **English**
- The project was originally specified in French (Cahier des Charges) but all implementation is strictly English
- Spec documents (requirements.md, design.md, tasks.md) are in English

---

## Tech Stack (Non-Negotiable)

- **Runtime:** Bun 1.3+ running inside WSL2 (Ubuntu) on Windows
- **Framework:** Hono (NOT Express)
- **Database:** PostgreSQL with Bun.sql built-in client (NOT pg/node-postgres)
- **Scheduler:** Bun.cron() built-in (NOT node-cron)
- **Scraping:** cheerio + undici (NOT Crawlee — Crawlee is Node.js only)
- **Validation:** Zod
- **Auth:** JWT (jsonwebtoken) + bcrypt
- **Testing:** bun test built-in (NOT Jest)
- **Language:** TypeScript with ESM imports (import/export, NOT require/module.exports)
- **Frontend:** React + Vite (NOT Next.js)

---

## Code Style

- All source files use `.ts` extension (TypeScript)
- Use ESM: `import`/`export`, never `require`/`module.exports`
- Use `as const` for readonly arrays/objects used as types
- Parameterized queries always — never string interpolation in SQL
- Error responses always follow this format:
  ```json
  { "error": { "code": "ERROR_CODE", "message": "...", "fields": [] } }
  ```
- HTTP status codes: 200 OK, 400 Validation Error, 401 Unauthorized, 404 Not Found, 500 Internal Error

---

## File Organization

- Backend runs in `apps/backend/` directory
- Frontend runs in `apps/frontend/` directory
- Admin panel runs in `apps/admin/` directory
- Team documentation in `notes/` (committed to Git) — this is the single source of truth for docs
- PlantUML source files in `notes/diagrams/` (committed to Git)
- Rendered PNGs in `notes/diagrams/rendered/` (gitignored — regeneratable)
- Kiro specs in `.kiro/specs/` (gitignored)
- Never put source files in the root directory

---

## Git Rules

- Always commit to `main` branch (no feature branches for this project)
- Commit message format: `type: short description` (conventional commits)
  - `feat:` new feature
  - `fix:` bug fix
  - `chore:` maintenance/setup
  - `docs:` documentation only
- Never commit `.env` files
- Never commit `node_modules/`
- Never commit `notes/diagrams/rendered/` or `notes/diagrams/rendered2/` (gitignored — generated artifacts)
- Never commit `.kiro/` folder (gitignored)
- Always ask user to approve commit message before committing
- Always show what will be committed before doing it

---

## Testing Rules

- Run **backend** tests via WSL2: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun test 2>&1"`
- Run **frontend** tests via WSL2: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/frontend && ~/.bun/bin/bun test 2>&1"`
- Expected: 578 backend tests + 28 frontend tests = 606 total, all passing
- Test files go in `__tests__/` subdirectories next to the code they test
- Test files excluded from main tsconfig to avoid VS Code errors (bun:test not available on Windows)
- Use `// @ts-nocheck` on test files if needed to suppress VS Code errors
- All tests must pass before marking a task complete

---

## WSL2 / Bun Execution

- Bun is installed at `~/.bun/bin/bun` in WSL2 Ubuntu
- WSL2 distro name: `Ubuntu`
- Project path in WSL2: `/mnt/c/Headquarters/Projects/PcBuilder/`
- WSL2 sudo password: `2525`
- Always use full path `~/.bun/bin/bun` when running Bun commands through WSL2 from PowerShell
- Command pattern: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun <command> 2>&1"`

---

## Documentation Rules

- `notes/` is the single source of truth for all project documentation — committed to Git
- After adding new features or concepts, update the relevant file in `notes/guide/` or `notes/features/`
- After adding new API routes, update `notes/reference/api.md` and `notes/guide/architecture.md`
- After adding new database tables or columns, update `notes/reference/database.md` and `notes/guide/database.md`
- Explain everything as if the reader knows nothing
- Include actual code snippets with explanations

### Notes directory structure

```
notes/
├── guide/              — How-to guides for working with the codebase
│   ├── architecture.md — API routes table, request lifecycle, DI pattern, implementation notes
│   ├── concepts.md     — Compatibility rules, DNA matching, variant model, scraper registry
│   └── database.md     — Schema overview, column table, design decisions
├── features/           — In-depth explanations of each major feature
│   ├── compatibility-engine.md
│   ├── scraping-system.md
│   ├── authentication.md
│   ├── component-catalog.md
│   ├── price-comparison.md
│   └── admin-panel.md
├── reference/          — Precise technical reference (look things up here)
│   ├── api.md          — Every endpoint with request/response shapes
│   ├── database.md     — All tables, columns, constraints, indexes
│   ├── dev-setup.md    — How to run the stack locally
│   └── stack.md        — Technology choices and rationale
├── diagrams/           — PlantUML source files + rendered PNGs
├── spec/               — Original Cahier des Charges (LaTeX)
├── glossary.md         — Key terms and definitions
├── roadmap.md          — Project history and current status
└── README.md           — Entry point — start here
```

---

## Diagram Rules

- PlantUML source files live in `notes/diagrams/` (committed to Git)
- Rendered PNGs go in `notes/diagrams/rendered/` (gitignored)
- PlantUML jar is NOT committed — place at project root
- Always generate PNGs with: `java -jar plantuml.jar -tpng notes/diagrams/*.puml -o rendered`
- 6 diagrams: use_case, class, activity, sequence_compatibility, sequence_scraping, sequence_admin

---

## Change Checklists

These checklists are mandatory. Every time one of these changes is made, ALL items in the checklist must be completed — never partial.

### Adding a new component category

- [ ] Create a new migration file in `apps/backend/src/db/migrations/` (next number after 019) — add the new column(s) there. **Never edit existing migration files.**
- [ ] Add Zod schema in `apps/backend/src/schemas/componentSchemas.ts`
- [ ] Add entry to `componentSchemas` map
- [ ] Update `ComponentCategory` type
- [ ] Update `Component` interface in `shared/types.ts`
- [ ] Add compatibility rules if the new category interacts with others
- [ ] Update `notes/reference/database.md` — add column to the category/column table
- [ ] Update `notes/guide/database.md` — add column to the category/column table
- [ ] Update `notes/glossary.md` — add the new category and any new terms
- [ ] Update `notes/diagrams/class.puml` — add the new subclass
- [ ] Run all tests and confirm they pass

### Adding a new compatibility rule

- [ ] Add the rule in `apps/backend/src/services/compatibilityService.ts`
- [ ] Add the required field(s) to the affected component type(s) in the function signature
- [ ] Add the required field(s) to the database schema if not already present
- [ ] Add the required field(s) to the Zod schema for the affected category
- [ ] Write unit tests covering: rule fires when condition is met, rule does not fire when condition is not met, rule does not fire when one component is absent
- [ ] Update `notes/guide/concepts.md` — add the new rule to the compatibility rules section
- [ ] Update `notes/features/compatibility-engine.md` — add the rule explanation
- [ ] Update `notes/glossary.md` — add any new terms introduced by the rule
- [ ] Update `notes/diagrams/sequence_compatibility.puml` if the validation flow changes
- [ ] Run all tests and confirm they pass

### Adding a new API route

- [ ] Create the route file in `apps/backend/src/routes/`
- [ ] Wire it in `apps/backend/src/app.ts`
- [ ] Apply `authMiddleware` if it is a protected route
- [ ] Apply `validateComponent` if it accepts a component body
- [ ] Write unit/integration tests for the route
- [ ] Update `notes/guide/architecture.md` — add the route to the API routes table
- [ ] Update `notes/reference/api.md` — add full endpoint documentation
- [ ] Update `notes/glossary.md` if new concepts are introduced
- [ ] Run all tests and confirm they pass

### Adding a new database table or column

- [ ] Create or update the migration file in `apps/backend/src/db/migrations/`
- [ ] Update the relevant TypeScript interface(s) in the service layer
- [ ] Update `notes/reference/database.md` — document the new table or column
- [ ] Update `notes/guide/database.md` — update the category/column table if applicable
- [ ] Update `notes/glossary.md` if new SQL concepts are introduced

---

## Behavior Rules

- Never say "Understood" and do nothing — always act immediately
- Never create files without explaining what they do
- Always run diagnostics after editing TypeScript files
- Always run tests after implementing a feature
- Always ask for approval before committing to git
- Show commit title AND description before committing
- When asked to explain something, explain it simply with examples
- When a task is in progress, mark it in tasks.md
- When a task is complete, mark it complete in tasks.md

---

## Project Context

- Project: PC Builder Web Platform for Morocco
- Team: Salmane ELHJOUJI + Ghali KHARMOUDY
- School: EMSI Orangers, Casablanca
- Deadline: May 11, 2026
- Salmane handles the backend, Ghali handles the frontend
- The platform is a price comparator and compatibility checker — it does NOT sell anything
- Redirects users to Moroccan retailer websites to complete purchases
