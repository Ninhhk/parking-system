#!/usr/bin/env pwsh
<#
.SYNOPSIS
Parking Lot Partial Docker Migration Setup Script
Starts LPD Service and Backend in Docker, Frontend and DB run locally

.DESCRIPTION
This script automates the setup for partial Docker migration:
- LPD Service runs in Docker (port 8000)
- Backend API runs in Docker (port 5000)
- Frontend runs locally on your machine
- PostgreSQL database runs locally

.NOTES
Requires: Docker Desktop, PowerShell 5.1+, PostgreSQL installed locally
#>

# Set up error handling
$ErrorActionPreference = "Continue"

# Display header
Clear-Host
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Parking Lot Partial Docker Migration Setup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This setup will:" -ForegroundColor Yellow
Write-Host "  - Start LPD Service in Docker (port 8000)"
Write-Host "  - Start Backend API in Docker (port 5000)"
Write-Host "  - Frontend runs locally (you'll start it separately)"
Write-Host "  - Database runs locally (PostgreSQL must be running)"
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Docker
Write-Host "[1/5] Checking Docker daemon..." -ForegroundColor Green
try {
    $null = docker info 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Docker daemon is running" -ForegroundColor Green
    } else {
        throw "Docker not responding"
    }
} catch {
    Write-Host "✗ Docker daemon is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again."
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Step 2: Check PostgreSQL
Write-Host "[2/5] Checking PostgreSQL..." -ForegroundColor Green
$pgCheck = $false
try {
    $null = psql -U admin -d parking_lot -c "SELECT 1;" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ PostgreSQL is running and accessible" -ForegroundColor Green
        $pgCheck = $true
    }
} catch { }

if (-not $pgCheck) {
    Write-Host "⚠ PostgreSQL is not accessible" -ForegroundColor Yellow
    Write-Host "Make sure PostgreSQL is installed and running on localhost:5432"
    Write-Host ""
    Write-Host "To start PostgreSQL:"
    Write-Host "  Option 1: Start from Services (services.msc)"
    Write-Host "  Option 2: Run in PowerShell as Admin:"
    Write-Host "    pg_ctl -D 'C:\Program Files\PostgreSQL\16\data' start"
    Write-Host ""
    
    $response = Read-Host "Continue anyway? (y/n)"
    if ($response -ne 'y') {
        exit 1
    }
}
Write-Host ""

# Step 3: Setup environment
Write-Host "[3/5] Setting up environment..." -ForegroundColor Green
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env from .env.partial..."
    Copy-Item ".env.partial" ".env" -Force
    Write-Host "✓ .env created" -ForegroundColor Green
} else {
    Write-Host "✓ .env already exists" -ForegroundColor Green
}
Write-Host ""

# Step 4: Build and start Docker services
Write-Host "[4/5] Building and starting Docker containers..." -ForegroundColor Green
Write-Host "Starting LPD Service and Backend..."
& docker-compose -f docker-compose.partial.yml up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to start Docker containers" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Step 5: Wait for services and check health
Write-Host "[5/5] Waiting for services to be healthy..." -ForegroundColor Green
Start-Sleep -Seconds 5

Write-Host ""
& docker-compose -f docker-compose.partial.yml ps
Write-Host ""

# Final instructions
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✓ Setup Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access points:" -ForegroundColor Yellow
Write-Host "  Backend API:  http://localhost:5000"
Write-Host "  LPD Service:  http://localhost:8000"
Write-Host "  Frontend:     http://localhost:3000 (start manually)"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open a new terminal and run:"
Write-Host "     cd fe"
Write-Host "     npm install"
Write-Host "     npm run dev"
Write-Host ""
Write-Host "  2. Visit http://localhost:3000 in your browser"
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  View logs:       docker-compose -f docker-compose.partial.yml logs -f"
Write-Host "  Stop services:   docker-compose -f docker-compose.partial.yml down"
Write-Host "  View status:     docker-compose -f docker-compose.partial.yml ps"
Write-Host "  View backend:    docker-compose -f docker-compose.partial.yml logs backend"
Write-Host "  View LPD:        docker-compose -f docker-compose.partial.yml logs lpd-service"
Write-Host ""
Read-Host "Press Enter to continue"
