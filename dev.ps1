# dev.ps1 - Start the full PC Builder dev stack
# All processes run via WSL2/Bun (no Node/npm required on Windows)
# Usage: .\dev.ps1

Write-Host ""
Write-Host "PC Builder - Dev Stack Startup" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Backend - Bun hot reload on port 3000
Write-Host "Starting Backend  -> http://localhost:3000" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'BACKEND - Bun/Hono' -ForegroundColor Green; wsl -d Ubuntu -- bash -c 'cd /mnt/c/Headquarters/Projects/PcBuilder/backend; ~/.bun/bin/bun --hot src/server.ts'"

Start-Sleep -Milliseconds 1000

# Frontend - Vite via Bun on port 5173
Write-Host "Starting Frontend -> http://localhost:5173" -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'FRONTEND - Vite' -ForegroundColor Blue; wsl -d Ubuntu -- bash -c 'cd /mnt/c/Headquarters/Projects/PcBuilder/frontend; ~/.bun/bin/bun run dev'"

Start-Sleep -Milliseconds 1000

# Admin panel - Vite via Bun on port 5174
Write-Host "Starting Admin    -> http://localhost:5174/admin" -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'ADMIN - Vite' -ForegroundColor Magenta; wsl -d Ubuntu -- bash -c 'cd /mnt/c/Headquarters/Projects/PcBuilder/admin; ~/.bun/bin/bun run dev'"

Write-Host ""
Write-Host "All 3 processes started in separate windows." -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend  -> http://localhost:3000" -ForegroundColor Green
Write-Host "  Frontend -> http://localhost:5173" -ForegroundColor Blue
Write-Host "  Admin    -> http://localhost:5174/admin" -ForegroundColor Magenta
Write-Host ""
