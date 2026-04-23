# Git Workflow

Commit conventions, branch rules, and what's gitignored.

## Branch rules

Always commit directly to `main`. No feature branches for this project.

## Commit message format

Use **Conventional Commits**:

```
type: short description
```

| Prefix | When to use |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `chore:` | Maintenance, setup, config |
| `docs:` | Documentation only |

Examples:
```
feat: add compatibility validation endpoint
fix: return 404 when component not found
chore: add fast-check to devDependencies
docs: add task explainer for JWT auth
```

## Before committing

1. Run tests and confirm they pass
2. Check `git status` — make sure you're not accidentally staging `.env` or `node_modules`
3. Stage specific files rather than `git add .` when possible

```bash
git status
git add backend/src/routes/auth.ts
git commit -m "feat: add admin login route"
git push origin main
```

## What's gitignored

| Pattern | Why |
|---|---|
| `docs/` | Generated diagrams and PDFs — regeneratable, binary files |
| `.kiro/` | IDE-specific files — not relevant to other team members |
| `node_modules/` | Installed packages — reinstall with `bun install` |
| `.env` | Secret keys — never commit passwords or API keys |
| `dist/`, `build/` | Build outputs — regeneratable |
| `notes/.obsidian/` | Obsidian config — local IDE preference |
| `*.log` | Log files |
| `docs/plantuml.jar` | Build tool binary |

> The `.puml` diagram source files are **not** gitignored — they live in `notes/diagrams/` and are committed to Git.

## What IS committed

- All source code (`backend/src/`, `frontend/src/`)
- Migration files (`backend/src/db/migrations/`)
- Config files (`package.json`, `tsconfig.json`, `.env.example`)
- Notes and documentation (`notes/`)
- PlantUML source files (`notes/diagrams/*.puml`)

## Responsibility split

| Area | Developer |
|---|---|
| Backend (`backend/`) | Salmane |
| Frontend (`frontend/`) | Ghali |
| Notes (`notes/`) | Both |
