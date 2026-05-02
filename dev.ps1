# dev.ps1 - Start the full PC Builder dev stack
# Usage: .\dev.ps1

Write-Host ""
Write-Host "PC Builder - Dev Stack Startup" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# ── Kill existing WSL2 processes on our ports ─────────────────────────────────
Write-Host "Stopping existing processes..." -ForegroundColor Yellow

# Kill by port using fuser inside WSL2 (single line avoids CRLF issues)
wsl -d Ubuntu -- bash -c "fuser -k 3000/tcp 5173/tcp 5174/tcp 2>/dev/null; pkill -9 -f 'bun --hot' 2>/dev/null; pkill -9 -f vite 2>/dev/null; sleep 1"

Write-Host "Done. Starting fresh..." -ForegroundColor Yellow
Write-Host ""

Start-Sleep -Milliseconds 500

# ── Backend ───────────────────────────────────────────────────────────────────
Write-Host "Starting Backend  -> http://localhost:3000" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
  "Write-Host 'BACKEND - Bun/Hono' -ForegroundColor Green; wsl -d Ubuntu -- bash -c 'cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend; ~/.bun/bin/bun --hot src/server.ts'"

Start-Sleep -Milliseconds 1500

# ── Frontend ──────────────────────────────────────────────────────────────────
Write-Host "Starting Frontend -> http://localhost:5173" -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
  "Write-Host 'FRONTEND - Vite' -ForegroundColor Blue; wsl -d Ubuntu -- bash -c 'cd /mnt/c/Headquarters/Projects/PcBuilder/apps/frontend; ~/.bun/bin/bun run dev'"

Start-Sleep -Milliseconds 1000

# ── Admin ─────────────────────────────────────────────────────────────────────
Write-Host "Starting Admin    -> http://localhost:5174/admin" -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
  "Write-Host 'ADMIN - Vite' -ForegroundColor Magenta; wsl -d Ubuntu -- bash -c 'cd /mnt/c/Headquarters/Projects/PcBuilder/apps/admin; ~/.bun/bin/bun run dev'"

Write-Host ""
Write-Host "All 3 processes started in separate windows." -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend  -> http://localhost:3000" -ForegroundColor Green
Write-Host "  Frontend -> http://localhost:5173" -ForegroundColor Blue
Write-Host "  Admin    -> http://localhost:5174/admin" -ForegroundColor Magenta
Write-Host ""
