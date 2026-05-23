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

# 1. Auto-detect Docker & PostgreSQL
$DockerRunning = $false
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $DockerRunning = $true
    }
} catch {
    $DockerRunning = $false
}

if ($DockerRunning) {
    Write-Host "Docker is running. Checking PostgreSQL container..." -ForegroundColor Yellow
    # Check running containers via docker ps to avoid docker-compose interpolation errors
    $PgStatus = docker ps --filter "name=postgres" --filter "status=running" --format "{{.Names}}" 2>$null
    if (-not $PgStatus) {
        Write-Host "PostgreSQL container is not running. Starting it..." -ForegroundColor Yellow
        docker compose up -d postgres
    } else {
        Write-Host "PostgreSQL is already running in Docker ($PgStatus)." -ForegroundColor Green
    }
} else {
    Write-Host "Docker is not running or not installed. Assuming database is managed externally." -ForegroundColor DarkYellow
}


# 2. Auto-detect Native Bun vs WSL
$HasNativeBun = $false
try {
    $null = Get-Command bun -ErrorAction SilentlyContinue
    $HasNativeBun = $true
} catch {
    $HasNativeBun = $false
}

if ($HasNativeBun) {
    Write-Host "Detected native Bun on Windows! Running the dev stack natively..." -ForegroundColor Green
    Write-Host "Starting concurrently..." -ForegroundColor Cyan
    npx concurrently `
      --kill-others `
      -n "backend,frontend,admin" `
      -c "green,blue,magenta" `
      "bun --env-file=apps/backend/.env --hot apps/backend/src/server.ts" `
      "cd `"$FrontendPath`" && bun run dev" `
      "cd `"$AdminPath`" && bun run dev"
} else {
    Write-Host "Native Bun not found on Windows. Falling back to WSL..." -ForegroundColor Yellow
    Write-Host "Starting concurrently via WSL..." -ForegroundColor Cyan
    npx concurrently `
      --kill-others `
      -n "backend,frontend,admin" `
      -c "green,blue,magenta" `
      "wsl bash -c 'export PATH=/home/omux/.bun/bin:`$PATH; bun --env-file=apps/backend/.env --hot apps/backend/src/server.ts'" `
      "wsl --cd $FrontendPath bash -c 'export PATH=/home/omux/.bun/bin:`$PATH; bun run dev'" `
      "wsl --cd $AdminPath bash -c 'export PATH=/home/omux/.bun/bin:`$PATH; bun run dev'"
}

Write-Host ""
Write-Host "Unified dev stack stopped." -ForegroundColor Cyan

