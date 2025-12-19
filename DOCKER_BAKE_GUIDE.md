# Docker Bake Guide for Parking Lot Project

## What is Docker Bake?

Docker Bake (`docker buildx bake`) is a high-level build command that allows you to build multiple images in parallel using a single configuration file. It's more powerful than `docker-compose build` and offers better caching and performance.

## Prerequisites

1. **Start Docker Desktop** - Make sure Docker Desktop is running
2. **Enable BuildKit** - Already configured in your project via `enable-docker-buildkit.ps1`

## Quick Start

### 1. Print the build plan (verify configuration):
```powershell
docker buildx bake --print
```

### 2. Build all services (lpd-service + backend):
```powershell
docker buildx bake
```

### 3. Build a specific service:
```powershell
# Build only the LPD service
docker buildx bake lpd-service

# Build only the backend
docker buildx bake backend
```

### 4. Build with detailed output:
```powershell
docker buildx bake --progress=plain
```

### 5. Build without cache (clean build):
```powershell
docker buildx bake --no-cache
```

## Available Targets

The `docker-bake.hcl` file defines several targets:

### Default Target Group
- Builds both `lpd-service` and `backend`
- Command: `docker buildx bake`

### Individual Services
- **lpd-service**: License Plate Detection Service (Python/Flask)
- **backend**: Backend API (Node.js/Express)

### Special Targets
- **dev**: For local development with local cache
  ```powershell
  docker buildx bake dev
  ```

- **ci**: For CI/CD with GitHub Actions cache
  ```powershell
  docker buildx bake ci
  ```

## Configuration Variables

You can override variables when building:

```powershell
# Build with custom tag
docker buildx bake --set *.tags=myapp:v1.0.0

# Build with registry prefix
docker buildx bake --set REGISTRY=myregistry.io/

# Build with custom tag variable
docker buildx bake --set TAG=v2.0.0
```

## Advantages Over docker-compose build

1. **Parallel Building**: Builds multiple images simultaneously
2. **Better Caching**: Advanced cache management with registry and local caching
3. **Multi-platform Support**: Build for different architectures
4. **Flexible Targeting**: Build specific services or groups
5. **Variables & Inheritance**: Reusable configuration with HCL syntax
6. **Better CI/CD Integration**: First-class support for GitHub Actions cache

## Integration with Docker Compose

After building with Docker Bake, run your services with:

```powershell
# Using the partial compose file
docker-compose -f docker-compose.partial.yml up -d

# Or use the startup script
.\start-partial-docker.ps1
```

## Cache Management

### Local Cache (Development)
```powershell
# Build with local cache
docker buildx bake dev

# Clear local cache
Remove-Item -Recurse -Force /tmp/.buildx-cache
```

### Registry Cache (Production)
The default configuration uses registry caching for better performance across builds:
- Cache is stored in: `parking-lot-{service}:buildcache`
- Automatically used in subsequent builds

## Troubleshooting

### Docker Desktop Not Running
```
ERROR: error during connect: Head "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/_ping"
```
**Solution**: Start Docker Desktop

### BuildKit Not Enabled
```
ERROR: buildx is not supported
```
**Solution**: Run `.\enable-docker-buildkit.ps1` or set environment variable:
```powershell
$env:DOCKER_BUILDKIT=1
```

### Out of Disk Space
**Solution**: Clean up Docker:
```powershell
docker system prune -a
docker builder prune -a
```

## Next Steps

1. Start Docker Desktop
2. Run `docker buildx bake --print` to verify configuration
3. Run `docker buildx bake` to build both services
4. Run `docker-compose -f docker-compose.partial.yml up` to start services

## Comparison with Your Current Workflow

| Feature | docker-compose build | docker buildx bake |
|---------|---------------------|-------------------|
| Parallel builds | ✅ Yes | ✅ Yes (better) |
| Cache management | Basic | Advanced |
| Multi-platform | ❌ No | ✅ Yes |
| Custom targets | ❌ Limited | ✅ Flexible |
| HCL syntax | ❌ No | ✅ Yes |
| GitHub Actions cache | ❌ No | ✅ Yes |
| Configuration reuse | ❌ No | ✅ Yes |

## Example Workflow

```powershell
# 1. Build images with bake
docker buildx bake

# 2. Start services with compose
docker-compose -f docker-compose.partial.yml up -d

# 3. Check status
docker-compose -f docker-compose.partial.yml ps

# 4. View logs
docker-compose -f docker-compose.partial.yml logs -f

# 5. Stop services
docker-compose -f docker-compose.partial.yml down
```
