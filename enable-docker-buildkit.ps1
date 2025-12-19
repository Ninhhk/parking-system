# Docker BuildKit Configuration Guide for Parking Lot Project
# This enables fast, efficient builds with layer caching

# For Windows PowerShell, run this script to enable Docker BuildKit

# Step 1: Enable Docker BuildKit for all future builds
$env:DOCKER_BUILDKIT = 1
[Environment]::SetEnvironmentVariable("DOCKER_BUILDKIT", "1", "User")

Write-Host "✓ Docker BuildKit enabled for current session"
Write-Host "✓ DOCKER_BUILDKIT set in User environment variables"

# Step 2: Verify BuildKit is available
$dockerVersion = docker version 2>&1 | Select-String "Server" -A 5
Write-Host "`n📋 Docker Version Info:"
Write-Host $dockerVersion

# Step 3: Display build optimization info
Write-Host "`n" 
Write-Host "🚀 Optimization Settings Applied:"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "✓ BuildKit enabled (faster builds, better caching)"
Write-Host "✓ Multi-stage builds configured (reduced final image size)"
Write-Host "✓ BuildKit cache mounts enabled (pip packages cached)"
Write-Host "✓ Layer caching optimized (proper dependency order)"
Write-Host ""

Write-Host "📊 Expected Performance Improvements:"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "• First LPD build:       5-10 minutes → 4-6 minutes"
Write-Host "• Subsequent LPD builds: 3-5 minutes → 1-2 minutes (cache hit)"
Write-Host "• Backend image size:    ~180MB → ~130MB (no dev deps)"
Write-Host "• LPD build cache:       Pip packages persist across rebuilds"
Write-Host ""

Write-Host "🔧 Usage Examples:"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""
Write-Host "Production Full Stack:"
Write-Host "  docker-compose up --build"
Write-Host ""
Write-Host "Development Stack:"
Write-Host "  docker-compose -f docker-compose.dev.yml up --build"
Write-Host ""
Write-Host "Partial Stack (LPD + Backend, local DB & Frontend):"
Write-Host "  docker-compose -f docker-compose.partial.yml up --build"
Write-Host ""

Write-Host "💡 Tips:"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "• BuildKit cache persists between builds automatically"
Write-Host "• For clean builds, use: docker system prune --all"
Write-Host "• View layer caching: docker build --verbose"
Write-Host "• To disable BuildKit: Remove DOCKER_BUILDKIT env var"
Write-Host ""

Write-Host "✅ BuildKit configuration complete!"
