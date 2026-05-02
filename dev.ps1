# dev.ps1 - Start the full PC Builder dev stack
# All processes run via WSL2/Bun (no Node/npm required on Windows)
# Usage: .\dev.ps1

Write-Host ""
Write-Host "PC Builder - Dev Stack Startup" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# ── Kill any existing processes on our ports ──────────────────────────────────
Write-Host "Stopping existing processes on ports 3000, 5173, 5174..." -ForegroundColor Yellow

foreach ($port in @(3000, 5173, 5174)) {
    $pids = (netstat -ano | Select-String ":$port\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' })

    foreach ($pid in $pids) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        } catch {}
    }
}

# Also kill any lingering bun/vite processes in WSL2
wsl -d Ubuntu -- bash -c "pkill -f 'bun --hot src/server' 2>/dev/null; pkill -f 'vite' 2>/dev/null; sleep 1" 2>$null

Write-Host "Done. Starting fresh..." -ForegroundColor Yellow
Write-Host ""

Start-Sleep -Milliseconds 500

# ── Backend - Bun hot reload on port 3000 ────────────────────────────────────
Write-Host "Starting Backend  -> http://localhost:3000" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'BACKEND - Bun/Hono' -ForegroundColor Green; wsl -d Ubuntu -- bash -c 'cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend; ~/.bun/bin/bun --hot src/server.ts'"

Start-Sleep -Milliseconds 1500

# ── Frontend - Vite via Bun on port 5173 ─────────────────────────────────────
Write-Host "Starting Frontend -> http://localhost:5173" -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'FRONTEND - Vite' -ForegroundColor Blue; wsl -d Ubuntu -- bash -c 'cd /mnt/c/Headquarters/Projects/PcBuilder/apps/frontend; ~/.bun/bin/bun run dev'"

Start-Sleep -Milliseconds 1000

# ── Admin panel - Vite via Bun on port 5174 ──────────────────────────────────
Write-Host "Starting Admin    -> http://localhost:5174/admin" -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'ADMIN - Vite' -ForegroundColor Magenta; wsl -d Ubuntu -- bash -c 'cd /mnt/c/Headquarters/Projects/PcBuilder/apps/admin; ~/.bun/bin/bun run dev'"

Write-Host ""
Write-Host "All 3 processes started in separate windows." -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend  -> http://localhost:3000" -ForegroundColor Green
Write-Host "  Frontend -> http://localhost:5173" -ForegroundColor Blue
Write-Host "  Admin    -> http://localhost:5174/admin" -ForegroundColor Magenta
Write-Host ""
