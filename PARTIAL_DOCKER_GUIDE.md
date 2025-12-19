# Parking Lot - Partial Docker Migration Guide

## Overview

This guide explains how to run **only** the LPD (License Plate Detection) Service and Backend API in Docker, while keeping the Frontend and PostgreSQL Database running **locally** on your machine.

### What Runs Where

| Component | Location | Port | Status |
|-----------|----------|------|--------|
| **Frontend (Next.js)** | Local (your machine) | 3000 | Run manually |
| **Backend API (Node.js)** | Docker Container | 5000 | Managed by Docker |
| **LPD Service (Python)** | Docker Container | 8000 | Managed by Docker |
| **PostgreSQL Database** | Local (your machine) | 5432 | Must be running |

### Benefits of Partial Docker

✅ **Frontend Development**: Develop frontend locally with hot-reload (npm run dev)  
✅ **Faster Iteration**: Changes to frontend don't require Docker rebuild  
✅ **Direct DB Access**: No Docker network complexity for database  
✅ **Resource Efficient**: Only 2 containers instead of 4  
✅ **Easy Debugging**: Backend and LPD logs are easily accessible  
✅ **Production Ready**: Same Docker setup scales to full Docker deployment  

---

## Prerequisites

Before starting, ensure you have:

1. **Docker Desktop** installed and running
   - Download: https://www.docker.com/products/docker-desktop
   - Verify: Run `docker --version` in PowerShell

2. **PostgreSQL** installed locally (or already running)
   - Windows: https://www.postgresql.org/download/windows/
   - Default Port: `5432`
   - Default User: `admin`
   - Default Password: `password123` (change in production)

3. **Node.js** (for running frontend locally)
   - Verify: Run `node --version` in PowerShell

4. **Git** (for cloning/pulling updates)

---

## Quick Start (5 minutes)

### 1. Ensure PostgreSQL is Running

```powershell
# Check if PostgreSQL is running
psql -U admin -d postgres

# If not running, start it (Windows Services)
# Or from PowerShell as Admin:
pg_ctl -D "C:\Program Files\PostgreSQL\16\data" start

# If PostgreSQL doesn't exist, install it first
# https://www.postgresql.org/download/windows/
```

### 2. Copy Environment File

```powershell
cd "D:\Project 2_20242\Tun\parking-lot"

# Copy the partial environment configuration
Copy-Item ".env.partial" ".env" -Force
```

### 3. Start Docker Services

Using the provided **PowerShell script** (Recommended):

```powershell
# Run the automated setup script
.\start-partial-docker.ps1
```

Or **manually**:

```powershell
# Build and start LPD + Backend containers
docker-compose -f docker-compose.partial.yml up -d --build

# Verify services are running
docker-compose -f docker-compose.partial.yml ps
```

### 4. Start Frontend Locally

Open a **new terminal window**:

```powershell
cd fe

# Install dependencies (first time only)
npm install

# Start development server
npm run dev

# Frontend will be available at http://localhost:3000
```

### 5. Verify Everything

Test all access points:

```powershell
# Test Backend API
curl http://localhost:5000/health

# Test LPD Service
curl http://localhost:8000/health

# Test Frontend
Start-Process http://localhost:3000
```

Expected results:
- ✅ Backend returns: `200 OK`
- ✅ LPD returns: `200 OK` with JSON health check
- ✅ Frontend opens in browser at http://localhost:3000

---

## File Structure

### New Files Created

```
parking-lot/
├── docker-compose.partial.yml    ← Use this instead of docker-compose.yml
├── .env.partial                  ← Copy to .env for this setup
├── start-partial-docker.ps1      ← Automated setup script (PowerShell)
├── start-partial-docker.bat      ← Automated setup script (Batch)
└── PARTIAL_DOCKER_GUIDE.md       ← This file
```

### Key Configuration Files

- **`docker-compose.partial.yml`** - Only LPD and Backend services
- **`.env.partial`** - Environment variables for partial Docker setup
  - `DB_HOST=host.docker.internal` ← Allows Docker containers to reach local PostgreSQL
  - `LPD_API_URL=http://lpd-service:8000` ← Internal Docker network communication

---

## Configuration Details

### Environment Variables

The `.env.partial` file contains:

```dotenv
# Database (LOCAL - PostgreSQL on your machine)
DB_HOST=host.docker.internal      # Magic hostname for Windows Docker
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=password123
DB_NAME=parking_lot

# Backend (DOCKER)
NODE_ENV=production
PORT=5000
JWT_SECRET=your-very-secure-jwt-secret-key-change-in-production

# Frontend (LOCAL)
NEXT_PUBLIC_API_URL=http://localhost:5000

# LPD Service (DOCKER)
FLASK_ENV=production
PLATE_MODEL_PATH=/app/models/best.pt
LOG_LEVEL=INFO

# Container Networking
LPD_API_URL=http://lpd-service:8000    # How Backend reaches LPD
```

### Important: `host.docker.internal`

On **Windows**, Docker containers cannot use `localhost` to reach your machine. Instead, use **`host.docker.internal`**:

- ✅ **CORRECT**: `DB_HOST=host.docker.internal`
- ❌ **WRONG**: `DB_HOST=localhost`

This is handled automatically in `docker-compose.partial.yml` via:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

---

## Common Commands

### Start/Stop Services

```powershell
# Start all services (LPD + Backend)
docker-compose -f docker-compose.partial.yml up -d

# Stop all services
docker-compose -f docker-compose.partial.yml down

# Restart services
docker-compose -f docker-compose.partial.yml restart

# Rebuild services (use after code changes)
docker-compose -f docker-compose.partial.yml up -d --build

# Remove containers and volumes
docker-compose -f docker-compose.partial.yml down -v
```

### View Logs

```powershell
# View all logs
docker-compose -f docker-compose.partial.yml logs -f

# View specific service logs
docker-compose -f docker-compose.partial.yml logs -f backend
docker-compose -f docker-compose.partial.yml logs -f lpd-service

# View last 50 lines
docker-compose -f docker-compose.partial.yml logs --tail=50

# View logs with timestamps
docker-compose -f docker-compose.partial.yml logs -f -t
```

### Check Status

```powershell
# List all running containers
docker-compose -f docker-compose.partial.yml ps

# Check container health
docker-compose -f docker-compose.partial.yml ps --filter status=healthy

# Inspect backend container
docker exec parking-lot-backend npm list
```

### Execute Commands in Containers

```powershell
# Run Node.js commands in backend
docker exec parking-lot-backend npm run seed

# Run Python commands in LPD
docker exec parking-lot-lpd python -c "from services.plate_normalizer import PlateNormalizer; print(PlateNormalizer.sanitize('51G-39466'))"

# Access backend shell
docker exec -it parking-lot-backend /bin/sh

# Access LPD shell
docker exec -it parking-lot-lpd /bin/bash
```

---

## Troubleshooting

### Backend Cannot Connect to Database

**Error**: `Cannot reach database at localhost:5432`

**Solution**:
```powershell
# 1. Verify PostgreSQL is running
psql -U admin -d postgres

# 2. Check DB_HOST in .env is 'host.docker.internal' (not 'localhost')
cat .env | grep DB_HOST

# 3. Check backend logs
docker-compose -f docker-compose.partial.yml logs backend

# 4. If still not working, verify PostgreSQL is accepting connections
psql -U admin -h localhost -d postgres
```

### Backend Cannot Connect to LPD Service

**Error**: `Cannot reach LPD service`

**Solution**:
```powershell
# 1. Verify LPD container is running
docker-compose -f docker-compose.partial.yml ps lpd-service

# 2. Check LPD_API_URL in .env
cat .env | grep LPD_API_URL
# Should be: LPD_API_URL=http://lpd-service:8000

# 3. Check LPD service logs
docker-compose -f docker-compose.partial.yml logs lpd-service

# 4. Test LPD from host machine
curl http://localhost:8000/health
```

### Frontend Cannot Connect to Backend

**Error**: `Failed to fetch from http://localhost:5000`

**Solution**:
```powershell
# 1. Verify backend is running
docker-compose -f docker-compose.partial.yml ps backend

# 2. Test backend directly
curl http://localhost:5000/health

# 3. Check NEXT_PUBLIC_API_URL in frontend .env
cat fe/.env | grep NEXT_PUBLIC_API_URL
# Should be: NEXT_PUBLIC_API_URL=http://localhost:5000

# 4. Restart frontend
cd fe && npm run dev
```

### Docker Build Fails

**Error**: `Build failed with context deadline exceeded`

**Solution**:
```powershell
# 1. Clean up Docker resources
docker system prune -a

# 2. Rebuild from scratch
docker-compose -f docker-compose.partial.yml build --no-cache

# 3. Try starting again
docker-compose -f docker-compose.partial.yml up -d
```

### Port Already in Use

**Error**: `Bind for 0.0.0.0:5000 failed: port is already allocated`

**Solution**:
```powershell
# Find process using port 5000
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue).OwningProcess

# Kill the process (adjust PID number)
Stop-Process -Id 1234 -Force

# Or change port in docker-compose.partial.yml
# Change: "5000:5000" to "5001:5000"
```

### Models File Not Found

**Error**: `PLATE_MODEL_PATH=/app/models/best.pt not found`

**Solution**:
```powershell
# Check if model file exists locally
Test-Path "Licence-Plate-Detection-Recognition-Recording/models/best.pt"

# If missing, download from the project or train a new model
# https://github.com/TunnTunn/parking-lot/wiki/Model-Setup

# Verify volume mount in docker-compose.partial.yml
# Line should be:
# - ./Licence-Plate-Detection-Recognition-Recording/models:/app/models
```

---

## Database Setup

### Initialize Database (First Time)

```powershell
# 1. Create database if it doesn't exist
psql -U admin -h localhost -c "CREATE DATABASE parking_lot;"

# 2. Run migrations from backend container
docker exec parking-lot-backend npm run migrate

# 3. Seed test data (optional)
docker exec parking-lot-backend npm run seed

# 4. Verify database is set up
docker exec parking-lot-backend npm run db:check
```

### Database Backup

```powershell
# Backup database
pg_dump -U admin -h localhost parking_lot > backup-$(Get-Date -Format 'yyyy-MM-dd').sql

# Restore database
psql -U admin -h localhost parking_lot < backup-2025-01-01.sql
```

---

## Switching Back to Full Docker

To run all services in Docker (Frontend + Database too):

```powershell
# Stop partial Docker setup
docker-compose -f docker-compose.partial.yml down

# Use original docker-compose.yml
docker-compose up -d

# This will start all 4 services:
# - Frontend
# - Backend
# - LPD Service
# - PostgreSQL
```

---

## Performance Tips

### 1. Disable Unnecessary Features

In `docker-compose.partial.yml`, remove health checks if not needed:
```yaml
# Remove or comment out health checks for faster startup
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  # ...
```

### 2. Rebuild Only Changed Services

```powershell
# Rebuild only backend
docker-compose -f docker-compose.partial.yml build backend

# Rebuild only LPD
docker-compose -f docker-compose.partial.yml build lpd-service
```

### 3. Use Development Compose File (Optional)

Create `docker-compose.dev.partial.yml` for development with:
- Volume mounts for source code
- Debug ports exposed
- Logging enabled

### 4. Monitor Resource Usage

```powershell
# Watch Docker stats in real-time
docker stats

# Check individual container stats
docker stats parking-lot-backend parking-lot-lpd
```

---

## Next Steps

1. ✅ Follow the **Quick Start** section above
2. ✅ Verify all services are running with `docker-compose ps`
3. ✅ Test the API at http://localhost:5000
4. ✅ Start frontend development with `npm run dev`
5. ✅ Open http://localhost:3000 and test the application
6. ✅ When ready for production, switch to full Docker setup

---

## Support & Documentation

- **Docker Compose Docs**: https://docs.docker.com/compose/
- **PostgreSQL on Windows**: https://www.postgresql.org/docs/current/
- **Node.js Docker**: https://hub.docker.com/_/node
- **Python Docker**: https://hub.docker.com/_/python
- **Project README**: See `README.md` in project root

---

## Version Info

- **Created**: December 2025
- **Docker Compose Version**: 3.9
- **Backend**: Node.js 18 (Alpine)
- **LPD Service**: Python 3.12
- **Database**: PostgreSQL 16
- **Frontend**: Next.js 14

---
