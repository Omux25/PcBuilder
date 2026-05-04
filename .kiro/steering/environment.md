---
inclusion: always
---

# Machine Environment — Kiro Context

These facts are true on this machine. Apply them to every session without asking.

---

## Operating System

- Windows 11, PowerShell terminal
- WSL2 installed with Ubuntu distro

---

## PowerShell Rules

- **Never use `&&` as a command separator** — it is not valid in PowerShell
- Use `;` instead: `git status; git log --oneline -5`
- For commands that must run in Linux, use the WSL2 pattern below

---

## GitHub CLI (gh)

- Installed at: `C:\Program Files\GitHub CLI\gh.exe`
- Always in PATH — use `gh` directly from PowerShell, no full path needed
- Authenticated as: `Omux25` (HTTPS, token stored in keyring)
- Token scopes: `gist`, `read:org`, `repo`, `workflow`
- **Use `gh` for all GitHub operations** (push, PR, repo management)

### Pushing commits

```powershell
# From PowerShell (Windows) — preferred
git push origin main

# If HTTPS auth fails from WSL2, use gh token:
gh auth token  # get token
# then set remote URL with token in WSL2
```

### If gh is not found in a new terminal session

```powershell
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
```

---

## WSL2 / Bun

- Distro: `Ubuntu`
- Bun path: `~/.bun/bin/bun`
- Project path in WSL2: `/mnt/c/Headquarters/Projects/PcBuilder/`
- WSL2 sudo password: `2525`
- Run Bun commands from PowerShell with:
  ```powershell
  wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun <command> 2>&1"
  ```
- **Never run Bun directly in PowerShell** — it is not installed on Windows

---

## Git

- Remote: `https://github.com/Omux25/PcBuilder.git`
- Default branch: `main`
- Git identity: `Salmane ELHJOUJI <omux25@gmail.com>` (set per-repo in WSL2)
- HTTPS auth from WSL2 requires token — use `gh auth token` to retrieve it
- Git commands run from PowerShell work fine (Windows git is installed)
- Git commands run from WSL2 need the token configured or embedded in remote URL

### Verify everything is in sync after pushing

```powershell
git log --oneline -5
# Should show: (HEAD -> main, origin/main) on the same commit
```

---

## Summary — which terminal to use for what

| Task | Use |
|---|---|
| Run tests | WSL2 (`wsl -d Ubuntu -- bash -c "..."`) |
| Run Bun server | WSL2 |
| Run migrations | WSL2 |
| Git status / log / add / commit | PowerShell or WSL2 |
| Git push | PowerShell (Windows git + gh credential helper) |
| gh commands (PR, auth, token) | PowerShell |
