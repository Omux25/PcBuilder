# dev.ps1 - Start the full PC Builder dev stack concurrently in one terminal
# All processes run via WSL2/Bun
# Usage: .\dev.ps1

$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) { $ProjectRoot = Get-Location }

Write-Host ""
Write-Host "PC Builder - Unified Dev Stack" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "Project Root: $ProjectRoot"
Write-Host ""

# Define app paths (Windows style)
$BackendPath = Join-Path $ProjectRoot "apps\backend"
$FrontendPath = Join-Path $ProjectRoot "apps\frontend"
$AdminPath = Join-Path $ProjectRoot "apps\admin"

# Run all 3 concurrently
# We use npx concurrently to multiplex the logs into a single terminal window.
# We use --cd with Windows paths and keep the bash command simple to avoid quoting issues.
npx concurrently `
  --kill-others `
  -n "backend,frontend,admin" `
  -c "green,blue,magenta" `
  "wsl --cd $BackendPath bash -c '~/.bun/bin/bun run dev'" `
  "wsl --cd $FrontendPath bash -c '~/.bun/bin/bun run dev'" `
  "wsl --cd $AdminPath bash -c '~/.bun/bin/bun run dev'"

Write-Host ""
Write-Host "Unified dev stack stopped." -ForegroundColor Cyan
