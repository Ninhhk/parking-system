# License Plate OCR Integration

This project now supports a prototype license plate capture & check‑in flow using a standalone Python script in `plate-ocr/`.

## Constraints (Demo Conditions)
- Static vehicle or printed plate; no motion.
- Strong, uniform lighting on the plate.
- Camera: low-cost Logitech (or any USB cam) with plate clearly framed.

## Endpoints Used
- Login: `POST /api/auth/login` (session cookie based)
- Check-in: `POST /api/employee/parking/entry` body: `{ license_plate, vehicle_type }`

## Normalization
Incoming `license_plate` is sanitized server-side (`be/utils/licensePlate.js`), stripping invalid characters and collapsing hyphens. OCR confusions are corrected **position-aware** against the Vietnamese civilian plate shape (`<2 province digits><1-2 series letters [+ digit]><serial digits>`, e.g. `30A`, `30AB`, `19DE`, `90B2`): letter→digit (`O→0, I→1, Z→2, S→5, B→8`) at digit positions, digit→letter at series-letter positions. This preserves real series letters (e.g. `90-B2` stays `90B2` not `9082`; `30AB` stays `30AB` not `30A8`). Strings that don't match the shape are returned raw. The Python LPD normalizer (`Licence-Plate-Detection-Recognition-Recording/services/plate_normalizer.py`) mirrors this logic.

## Python Script Overview
File: `plate-ocr/plate_capture.py`
Flow:
1. Login (obtain session cookie).
2. Capture single frame from camera.
3. Detect plate region (YOLO ONNX if `yolo_plate.onnx` present, else contour heuristic fallback).
4. Preprocess (grayscale, CLAHE, Otsu threshold).
5. OCR via EasyOCR (allowlist A–Z, 0–9, `-`).
6. Sanitize locally; POST to backend.
7. Save cropped ROI image for audit.

## Setup (Python)
Create virtual environment then install dependencies:
```powershell
cd plate-ocr
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Optional: place a lightweight YOLO ONNX model as `plate-ocr/yolo_plate.onnx` for improved detection.

## Environment Variables (Optional)
Define (PowerShell examples):
```powershell
$env:BACKEND_BASE = "http://localhost:8000"
$env:EMPLOYEE_USER = "ninh1"
$env:EMPLOYEE_PASS = "ninh1"
$env:CAM_INDEX = "0"
```

Run script:
```powershell
python plate_capture.py
```

## Adjusting Vehicle Type
Default vehicle type is `car`. Modify call in `post_checkin` if needed or export `VEHICLE_TYPE` env and adapt script.

## Failure Modes
- Empty OCR result: script aborts (no check-in).
- Multiple contours / poor detection: falls back to whole frame (OCR may degrade).
- Login failure: raises exception (check credentials and backend running).

## Future Improvements
- Replace contour fallback with stable detector (e.g. YOLOv8n trained on license plates).
- Add retry loop with capped attempts when OCR empty.
- Integrate token-based auth to avoid login step.

---

# Dockerized PostgreSQL Bootstrap (Schema Migration)

This repo now includes a PostgreSQL service inside `docker-compose.yml` and schema bootstrap scripts under `db/init/`.

## What is included
- `postgres` service (`postgres:16-alpine`) with healthcheck and persistent volume.
- `db-migrate` service that replays all SQL files in `db/init/*.sql` on each startup.
- Backend default DB host changed to service DNS: `postgres`.
- Docker Postgres host port is mapped to `55432` by default to avoid conflicts with local PostgreSQL.
- Bootstrap init scripts mounted to `/docker-entrypoint-initdb.d` (first DB volume creation only):
	- `db/init/001_schema.sql`
	- `db/init/002_seed.sql`
	- `db/init/003_payment_attempts.sql`

## DBeaver / JDBC connection (Docker Postgres)
Use these values when connecting to the database running in Docker:
- JDBC URL: `jdbc:postgresql://localhost:55432/parking_lot`
- Host: `localhost`
- Port: `55432`
- Database: `parking_lot`
- Username: `admin`
- Password: `password123`

## First startup
```powershell
docker compose up -d --build
```

## Verify services
```powershell
docker compose ps
docker compose logs postgres --tail 100
docker compose logs db-migrate --tail 100
docker compose logs backend --tail 100
```

## Important behavior
- PostgreSQL init scripts run **only on first database volume creation**.
- `db-migrate` runs idempotent SQL (`db/init/*.sql`) on every `docker compose up`.
- For additive schema updates (new tables/indexes/constraints), no volume reset is required.
- Keep migration SQL idempotent (`IF NOT EXISTS`, safe `DROP IF EXISTS`) to avoid failures.

## Apply latest migration without full restart
```powershell
docker compose up -d db-migrate
docker compose logs db-migrate --tail 100
```

## Reset DB (fresh re-bootstrap)
```powershell
docker compose down -v
docker compose up -d --build
```

## Optional DB shell
```powershell
docker exec -it parking-lot-postgres psql -U admin -d parking_lot
```

---

# Payment Intent V2 Rollout

## Feature flag

- Env key: `PAYMENT_INTENT_V2_ENABLED`
- Default: `true`

Set in `.env` (or compose env):

```env
PAYMENT_INTENT_V2_ENABLED=true
```

## Backfill migration

Migration file: `db/init/005_payment_intents_backfill.sql`

Apply and verify:

```powershell
docker compose up -d db-migrate
docker compose logs db-migrate --tail 100
docker exec parking-lot-postgres psql -U admin -d parking_lot -c "SELECT session_id FROM payment_intents GROUP BY session_id HAVING COUNT(*) FILTER (WHERE status IN ('REQUIRES_PAYMENT_METHOD','PENDING')) > 1;"
```

Expected: zero rows.

## Comparison checklist

- `create_intent` and `reuse_intent` logs appear with `session_id/intent_id/attempt_id`
- webhook logs include `order_code` and `webhook_event_id`
- payment status on refresh resumes same active intent

## Rollback

1. Set `PAYMENT_INTENT_V2_ENABLED=false`
2. Restart backend container
3. Keep webhook endpoint online to avoid dropped provider callbacks (webhook finalize path remains active)
