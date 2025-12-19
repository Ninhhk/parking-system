# Docker Bake configuration for Parking Lot project
# Build all services: docker buildx bake
# Build specific service: docker buildx bake lpd-service
# Build with push: docker buildx bake --push

variable "TAG" {
  default = "latest"
}

variable "REGISTRY" {
  default = ""
}

group "default" {
  targets = ["lpd-service", "backend"]
}

target "lpd-service" {
  context    = "."
  dockerfile = "Dockerfile.lpd"
  tags = [
    "${REGISTRY}parking-lot-lpd:${TAG}",
    "${REGISTRY}parking-lot-lpd:latest"
  ]
  platforms  = ["linux/amd64"]
  args = {
    BUILDKIT_INLINE_CACHE = "1"
  }
  labels = {
    "org.opencontainers.image.title"       = "Parking Lot LPD Service"
    "org.opencontainers.image.description" = "License Plate Detection Service"
    "org.opencontainers.image.created"     = "${timestamp()}"
  }
}

target "backend" {
  context    = "."
  dockerfile = "Dockerfile.backend"
  tags = [
    "${REGISTRY}parking-lot-backend:${TAG}",
    "${REGISTRY}parking-lot-backend:latest"
  ]
  platforms  = ["linux/amd64"]
  args = {
    BUILDKIT_INLINE_CACHE = "1"
  }
  labels = {
    "org.opencontainers.image.title"       = "Parking Lot Backend"
    "org.opencontainers.image.description" = "Node.js Backend API"
    "org.opencontainers.image.created"     = "${timestamp()}"
  }
}

# Development target with local caching
target "dev" {
  inherits = ["lpd-service", "backend"]
  cache-from = ["type=local,src=/tmp/.buildx-cache"]
  cache-to   = ["type=local,dest=/tmp/.buildx-cache,mode=max"]
}

# CI/CD target with GitHub Actions cache
target "ci" {
  inherits = ["lpd-service", "backend"]
  cache-from = ["type=gha"]
  cache-to   = ["type=gha,mode=max"]
}
