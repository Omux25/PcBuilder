---
description: Run the custom update-context workflow to detect changes and sync codemaps, file catalogs, API specs, and runbooks.
---
# /update-context - Smart Unified Context & Documentation Sync

This workflow automates updating all project documentation and context files. When executed, it checks what files have changed relative to git (or what files are newly added) and updates the relevant documentation in a structured, token-efficient way.

---

## 🛠️ Step 1: Detect Changes

Run the following command to identify added, modified, or deleted files:

```bash
git status --porcelain
```

---

## 📋 Step 2: Update Targeted Documentation

Based on the paths detected in **Step 1**, perform the following targeted documentation updates:

### 🧩 Case A: Codebase & File Structure Changes
*   **Trigger**: Any added, deleted, renamed, or restructured files under `apps/`, `shared/`, or root.
*   **Actions**:
    1.  **Update Codemaps**: Generate or update the token-lean files under `codemaps/`:
        *   `codemaps/architecture.md` — Overall workspace relations and folder mappings.
        *   `codemaps/backend.md` — Backend structure.
        *   `codemaps/frontend.md` — Frontend layout and pages.
        *   `codemaps/data.md` — Data entities and schema definitions.
    2.  **Update File Catalog**: Update the entry in [docs/project_files_catalog.md](file:///c:/Headquarters/Projects/PcBuilder/docs/project_files_catalog.md) when key architectural files or entry-points are added, renamed, or removed. Keep it strictly curated: **exclude** build outputs (`dist/`, `build/`), compiled assets, dependencies, test files, migration lists, and configuration noise. Provide clear, hand-written explanations of each file's role rather than boilerplate statements.

### ⚙️ Case B: Configurations & Scripts
*   **Trigger**: Changes to `package.json`, `.env.example`, or `.env.production.example`.
*   **Actions**:
    1.  Sync scripts table and env variables list.
    2.  Regenerate/update [docs/CONTRIB.md](file:///c:/Headquarters/Projects/PcBuilder/docs/CONTRIB.md) (with new setup rules, script descriptions, or local workflows).
    3.  Regenerate/update [docs/RUNBOOK.md](file:///c:/Headquarters/Projects/PcBuilder/docs/RUNBOOK.md) (with deployment adjustments, new runtime env vars, and recovery procedures).

### 🌐 Case C: API Routes & Controller Logic
*   **Trigger**: Modification of routers or services under `apps/backend/src/`.
*   **Actions**:
    1.  Trigger the `document_api` skill to generate updated API schemas.
    2.  Sync the changes into the API documentation.

### 🗄️ Case D: DB Schema & Ingestion Pipelines
*   **Trigger**: Modifications to database migrations, schema files (`apps/backend/src/db/`), or shared model types in `shared/types.ts`.
*   **Actions**:
    1.  Sync database schemas under `codemaps/data.md`.
    2.  Update the pipeline maps in [docs/component_creation_pipelines.md](file:///c:/Headquarters/Projects/PcBuilder/docs/component_creation_pipelines.md) if the data flow or field mappings for component insertions have changed.

---

## 📝 Step 3: Generate Summary Walkthrough

At the end of the update, output a summary table in the chat of all files created or updated, detailing:
- **File Path**: Link to the updated doc file (e.g., `[architecture.md](file:///c:/Headquarters/Projects/PcBuilder/codemaps/architecture.md)`).
- **Update Type**: Structural / Config / API / Schema.
- **Summary of Changes**: 1-sentence description of what was synchronized.
