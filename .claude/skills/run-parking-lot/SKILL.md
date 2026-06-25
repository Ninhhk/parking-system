---
name: run-parking-lot
description: >
  Build, launch, and drive the parking lot management system (backend API, frontend,
  LPD service, database). Use when asked to run, start, launch, screenshot, smoke-test,
  or verify the parking-lot app is working.
---

# Run: Parking Lot Management System

Multi-service app: Express backend (port 5000), Next.js frontend (port 3000),
Python LPD/OCR service (port 8000), Postgres (port 55432), MinIO (ports 9000/9001).
Orchestrated via Docker Compose at repo root.

The primary agent interface is the **REST API** via `curl`. The driver is
`.claude/skills/run-parking-lot/smoke.sh` — a shell script that exercises
health checks, auth, check-in, and checkout in one pass.

Paths in this file are relative to the repo root.

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose v2)
- Node.js 18+ and npm
- Bash (Git Bash on Windows; any POSIX shell on Linux/macOS)

## Build

```bash
# Backend services (postgres, minio, lpd-service, backend)
docker compose up -d --build

# Frontend (separate process — not in Docker)
cd fe && npm install && npm run dev
```

Wait for all services to be healthy (`docker compose ps` shows all green).
The `db-migrate` and `minio-init` containers exit 0 after completing —
that is expected.

## Run (agent path — smoke test)

```bash
bash .claude/skills/run-parking-lot/smoke.sh
```

The smoke test verifies:
1. Health checks (backend, LPD, frontend)
2. Login + session auth
3. Employee dashboard, parking lots, active sessions
4. Check-in → checkout lifecycle
5. Auth guards (unauthenticated requests return 401)

All checks should pass. Failures include the actual vs expected value.

Override target URLs via environment variables:

```bash
BACKEND_URL=http://other-host:5000 bash .claude/skills/run-parking-lot/smoke.sh
```

## Run (human path)

- Frontend: `http://localhost:3000` — landing page, login, employee dashboard
- Backend API docs: see route files in `be/routes/`
- MinIO console: `http://localhost:9001` (minioadmin / minioadmin)
- Postgres: `docker exec -it parking-lot-postgres psql -U admin -d parking_lot`

## Quick API smoke (manual curl)

```bash
# Health
curl http://localhost:5000/health

# Login (saves session cookie)
curl -c /tmp/cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ninh1","password":"ninh1"}'

# Dashboard
curl -b /tmp/cookies.txt http://localhost:5000/api/employee/

# Check-in (use unique card_uid per run — duplicate plates are rejected)
curl -b /tmp/cookies.txt -X POST http://localhost:5000/api/employee/parking/entry \
  -H "Content-Type: application/json" \
  -d '{"license_plate":"30A99999","vehicle_type":"car","card_uid":"MANUAL_TEST_001"}'

# Initiate checkout for a session
curl -b /tmp/cookies.txt http://localhost:5000/api/employee/parking/exit/REPLACE_WITH_SESSION_ID

# Active sessions
curl -b /tmp/cookies.txt http://localhost:5000/api/employee/parking-sessions
```

## Direct invocation (bypass HTTP)

For PRs touching internal logic, import and call functions directly
via Node.js REPL or a throwaway script:

```bash
cd be
node -e "
  require('dotenv').config();
  const feeConfigRepo = require('./repositories/feeConfig.repo');
  // call functions here
"
```

Unit tests are the preferred direct-invocation path:

```bash
cd be && npx jest __tests__/services/checkout.service.test.js
cd fe && npx jest __tests__/hooks/
```

## Test

```bash
# Backend unit tests
cd be && npm test

# Backend single file
cd be && npx jest __tests__/services/checkin.concurrency.test.js --runInBand

# Integration tests (requires running Docker postgres + backend)
cd be && DB_HOST=localhost DB_PORT=55432 DB_USER=admin DB_PASSWORD=password123 DB_NAME=parking_lot \
  npx jest --testPathPattern="integration|concurrency|repo" --runInBand --forceExit

# Frontend
cd fe && npm test

# Python LPD
cd Licence-Plate-Detection-Recognition-Recording && pytest
```

## Restart / Reset

```bash
# Rebuild and restart backend (pick up code changes)
docker compose build --no-cache backend && docker compose up -d backend

# Restart everything, keep data
docker compose down && docker compose up -d --build

# Full reset (DELETES ALL DATA)
docker compose down -v && docker compose up -d --build
```

## Gotchas

- **Backend `.env` has `DB_PORT=55432`** for host-machine access. Inside Docker,
  `docker-compose.yml` overrides this to `5432` (the internal Postgres port). Do not
  change the compose override — that's the contract between containers.
- **Frontend runs outside Docker.** There is no `frontend` service in `docker-compose.yml`.
  Run `npm run dev` from `fe/` separately.
- **`db-migrate` container exits 0** after applying migrations. This is normal.
  `docker compose ps` shows it as `Exited (0)`, not unhealthy.
- **LPD needs model files** at `Licence-Plate-Detection-Recognition-Recording/repo5/model/`.
  The Docker build copies them in; if missing, `docker compose build --no-cache lpd-service`.
- **Integration tests need `--runInBand`** (serial execution). Multiple test files share
  the same DB pool; parallel runs cause `pool.end()` in one file to kill connections for others.
- **`DB_HOST=localhost` for host tests, `DB_HOST=postgres` for Docker.** The `.env` defaults
  to `postgres` (Docker DNS name). Override when running tests from the host.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `curl: (7) Failed to connect` for backend | `docker compose up -d backend` |
| `curl: (7) Failed to connect` for frontend | `cd fe && npm run dev` |
| Backend exits with `ECONNREFUSED postgres:5432` | Wait for postgres healthy, then `docker compose up -d backend` |
| LPD returns 503 | Wait for model load (~20s), check `docker compose logs lpd-service` |
| Login returns 401 with correct creds | Account may have been deleted — seed DB: `docker compose down -v && docker compose up -d --build` |
| `docker compose up` fails on port conflict | Port 55432 (postgres), 5000 (backend), 8000 (LPD), 9000/9001 (minio) must be free |
