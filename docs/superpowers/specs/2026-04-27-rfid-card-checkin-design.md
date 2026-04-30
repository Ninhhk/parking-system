# RFID Card Check-in Kiosk Design (Modular + Prod-aligned)

**Date:** 2026-04-27  
**Context:** Build a kiosk-style RFID card check-in page with click-through states, wired to real backend/database behavior, and designed as feature-toggle modules for production rollout.

## 1) Decisions Locked

- UI mode: **kiosk mode** (full-screen, large touch-friendly interface).
- Interaction level: **click-through states** (`idle`, `scanning`, `success`, `denied`, `error`).
- Architecture direction: **production-aligned** (real BE endpoint + real DB write path), not mock-only.
- API boundary: **separate RFID endpoint** (do not overload existing generic entry endpoint).
- Toggle strategy: **environment flags** only (no DB-driven runtime toggles in this phase).

## 2) Goals

- Provide a dedicated RFID check-in flow that maps cleanly to current DB constraints and parking session rules.
- Keep UI modular so modules can be enabled/disabled independently at deploy time.
- Ensure kiosk state outcomes are driven by real backend responses.
- Minimize future migration effort from kiosk mockup to production gate flow.

## 3) Non-goals (This Slice)

- Runtime admin panel for live module toggling.
- Physical gate hardware control integration.
- Reworking existing plate/manual check-in endpoint behavior.
- Redesigning parking session schema or constraints.

## 4) Chosen Architecture

### 4.1 Frontend (Kiosk Shell + Modules)

Create a dedicated employee kiosk route in FE that composes modules through a registry and flag gate:

- `ReaderPanel` (RFID card input/scan status)
- `VehicleFormPanel` (vehicle type + optional plate)
- `ResultPanel` (success/denied/error outcome)
- `GateStatusPanel` (visual gate state indicator)
- `RecentEventsPanel` (optional recent attempts list)

Each module receives shared state and typed actions from a parent kiosk state container. Disabled modules are not mounted.

### 4.2 Backend (Dedicated RFID Endpoint)

Add endpoint under employee routes:

- `POST /api/employee/parking/entry/rfid`

Keep current endpoint unchanged:

- `POST /api/employee/parking/entry`

RFID endpoint uses existing check-in domain logic and repository path to preserve transaction/capacity/uniqueness behavior.

## 5) Data and Contract Design

### 5.1 Request Contract (RFID Entry)

Required:

- `card_uid`
- `vehicle_type`

Optional:

- `license_plate`
- `entry_lane_id`
- `etag_epc`
- `image_in_url`
- `metadata_in`

### 5.2 Response-to-UI Mapping

Kiosk maps backend responses deterministically:

- `201` -> `success`
- `409` -> `denied` (duplicate active identity, lot capacity full)
- `422` -> `error` (validation)
- `404` -> `error` (lot/assignment missing)
- `500` -> `error` (unexpected failure)

### 5.3 DB Alignment Rules

UI and API behavior must align with existing schema and constraints:

- Session identity sources include `card_uid`, optional `etag_epc`, optional `license_plate`.
- Active session uniqueness constraints remain source of truth (`uq_active_session_card_uid`, `uq_active_session_etag_epc`, active plate uniqueness).
- Entry lane context carried via `entry_lane_id` when available.

## 6) Module Toggle Design (Env Flags)

### 6.1 Frontend Flags

Define module flags:

- `NEXT_PUBLIC_KIOSK_MODULE_READER=true`
- `NEXT_PUBLIC_KIOSK_MODULE_VEHICLE_FORM=true`
- `NEXT_PUBLIC_KIOSK_MODULE_RESULT=true`
- `NEXT_PUBLIC_KIOSK_MODULE_GATE_STATUS=true`
- `NEXT_PUBLIC_KIOSK_MODULE_RECENT_EVENTS=false`

### 6.2 Backend Feature Gate

- `RFID_CHECKIN_ENABLED=true`

If disabled, backend returns deterministic feature-disabled response for RFID endpoint.

### 6.3 Safety Behavior

- Disabled optional module: hidden and skipped in flow.
- Disabled required module: kiosk shows configuration error panel and blocks submission (safe-fail).

## 7) UX State Model

State machine:

- `idle` -> waiting for card input / operator action
- `scanning` -> pending API submission, controls locked
- `success` -> show ticket/session essentials (`session_id`, `time_in`, lane)
- `denied` -> business rejection with clear reason and reset
- `error` -> technical/validation issue with retry

Kiosk UX principles:

- Large typography and high contrast for gate-distance readability.
- Explicit lane badge display (`entry_lane_id`) for operator confidence.
- Deterministic reset/retry actions to avoid ambiguous terminal states.

## 8) Testing Strategy

### 8.1 Backend

- Route/controller tests for `POST /parking/entry/rfid` covering `201`, `409`, `422`, `404`, `500`.
- Constraint behavior tests confirming active-session uniqueness handling for `card_uid` / `etag_epc`.
- Feature-flag test for `RFID_CHECKIN_ENABLED=false` path.

### 8.2 Frontend

- Module registry tests for env-flag enable/disable behavior.
- API client tests for new RFID endpoint and status mapping.
- Interaction test for click-through state transitions (`idle -> scanning -> success/denied/error`).

## 9) Rollout and Compatibility Notes

- Keep legacy employee check-in endpoints untouched to avoid regression risk.
- Introduce RFID endpoint and kiosk page behind feature flags.
- Use same response envelope conventions as existing employee APIs.
- Preserve repository/service layering (`routes -> controllers -> services -> repositories -> DB`).

## 10) Why This Design

- Separate RFID endpoint preserves clean domain boundaries and long-term maintainability.
- Real wire-up prevents UI/DB contract drift that mock-only flows often introduce.
- Flag-based module composition gives production-safe rollout control without premature runtime config complexity.
- Click-through kiosk states maintain demo speed while still exercising real business outcomes.
