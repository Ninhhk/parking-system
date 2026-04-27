# Edge Ingest V1 Design (BE-first + Minimal FE Ops Console)

**Date:** 2026-04-20  
**Context:** Database foundation for hybrid edge check-in is complete. This spec defines the first backend and frontend implementation slice.

## 1) Decisions Locked

- Implementation order: **Backend first**.
- Gateway contract: **single unified ingest endpoint** with envelope payload.
- Idempotency: **strict global uniqueness by `event_id`**.
- Frontend scope in this phase: **minimal operations console**.

## 2) Goals

- Make ingest from edge devices reliable under duplicate delivery and concurrency.
- Keep one active parking session per identity (`card_uid`, `etag_epc`, optional `license_plate`) using DB constraints as source of truth.
- Support delayed LPD enrichment without creating duplicate sessions.
- Give operations a minimal UI to monitor ingest health and retry failed events.

## 3) Non-goals (V1)

- Device/lane admin CRUD and provisioning UI.
- Async queue/worker processing architecture.
- Full analytics and historical dashboarding.
- Breaking changes to existing employee check-in APIs.

## 4) Chosen Architecture

### 4.1 Backend Layers

Use existing backend layering conventions:

- `routes` -> `controllers` -> `services` -> `repositories` -> DB

### 4.2 Frontend Boundary

Create one FE operations page (App Router) that consumes backend APIs only:

- Active sessions table
- Ingest monitor table
- Filters and manual retry action for failed events

## 5) Data and Transaction Design

### 5.1 Ingest Event Store (Idempotency + Audit)

Ingest events are persisted in `edge_events` with:

- `event_id` (unique)
- `gateway_id`, `lane_id`, `trigger_type`, `trigger_value`
- `occurred_at`
- `payload_json` (JSONB raw envelope)
- `status` (`PROCESSING`, `SUCCESS`, `FAILED`)
- `session_id` (nullable)
- `error_code`, `error_message` (nullable)
- `created_at`, `updated_at`, retry metadata fields

### 5.2 Ingest Processing Sequence

For `POST /api/edge/events/ingest`:

1. Validate envelope and required fields.
2. Start DB transaction.
3. Acquire lane-scoped advisory transaction lock.
4. Check idempotency by `event_id`.
   - If prior event exists and replay is not requested: return duplicate response.
5. Persist ingest event as `PROCESSING`.
6. Apply trigger strategy:
   - `IC_CARD`/`UHF_TAG`/`MANUAL`: resolve or create active session.
   - `LPD`: enrich matched recent active session in the same lane within correlation window.
7. Persist resulting `session_id`, mark ingest event `SUCCESS`.
8. Commit transaction.

On ingest outcome failure (`LPD_UNMATCHED`, `CAPACITY_FULL`), backend responds with `422` and envelope:

- `{ success: false, message: <action>, data: { duplicate, status: "FAILED", action, event_id, session_id } }`

## 6) API Design (V1)

### 6.1 Ingest Endpoint

- `POST /api/edge/events/ingest`
  - Required request headers: `x-edge-api-key`
  - Required request envelope fields: `event_id`, `gateway_id`, `lane_id`, `occurred_at`, `lot_id`, `vehicle_type`, `trigger.type`
  - Trigger-specific fields:
    - `IC_CARD`/`UHF_TAG`/`MANUAL`: require non-empty `trigger.value`
    - `LPD`: require `trigger.value` or `trigger.plate`
  - Success response:
    - `{ success: true, data: { event_id, duplicate, session_id, action } }`
  - Validation or failed ingest outcome:
    - `422` with `success: false`

### 6.2 Operations Endpoints

- `GET /api/edge/events`
- `GET /api/edge/events/:eventId`
- `POST /api/edge/events/:eventId/retry`
- `GET /api/edge/sessions/active`

All endpoints keep the existing API response envelope pattern.

## 7) Frontend Minimal Ops Console (V1)

- Active sessions table includes session id, lane, identity fields, plate, time in, status.
- Ingest monitor table includes event id, trigger, lane, occurred time, status, failure reason.
- Filters include lane, trigger, status, time range, and keyword search.
- Failed event rows expose retry action.

## 8) Error Handling Model

- Validation errors: `422` with deterministic messages.
- Failed ingest outcomes: `422` with `success: false`, `message` set from domain action, and structured `data` payload.
- Unexpected failures: structured `500` response plus persisted failure details in ingest event store.

## 9) Testing Plan

### 9.1 Backend

- Unit tests for validation and trigger strategy branching.
- Integration tests for duplicate replay, delayed LPD enrichment, and failed outcomes.
- API tests for ingest success/failure envelopes and retry flow.

### 9.2 Frontend

- API client tests for events and active sessions endpoints.
- Component tests for filters, retry actions, and error rendering.

## 10) Operational Defaults (V1)

- Delayed LPD correlation window default: **5 seconds**.
- Ingest monitor polling interval: **10 seconds**.
- Retry access control: existing authenticated employee/admin guard pattern.
