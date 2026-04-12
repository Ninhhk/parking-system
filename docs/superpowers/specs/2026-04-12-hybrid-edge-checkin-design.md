# Hybrid Edge Check-In Design (Final Constraints)

## Endpoint

- `POST /api/employee/parking/edge/checkin-event`
- Auth: employee session required (`/api/employee` route guard)
- Success response: `201` with `{ success: true, message, session }`

## Required Request Fields

- Controller-level required fields for all calls:
  - `lane_id`
  - `trigger_type`
  - `vehicle_type`
  - `lot_id`

## Service-Level Validation and Behavior

- Service additionally requires:
  - `gateway_id` always
  - valid lane config for (`gateway_id`, `lane_id`) in `be/config/edge_gateways.json`
  - `trigger_type` must be enabled by lane policy (`allowed_trigger_modules`)
- Trigger behavior:
  - `LPD`: attempt enrichment first via lane correlation window (`correlation_window_seconds`, default `5`)
  - If LPD enrichment misses, create a new session (requires `lot_id` and `vehicle_type`)
  - Non-`LPD` triggers: create a new session (requires `lot_id` and `vehicle_type`)
- Identity fields supported on create:
  - `license_plate` (LPD/manual)
  - `card_uid` (CARD)
  - `etag_epc` (UHF)
- Optional enrich/create fields:
  - `image_in_url`
  - `metadata` (merged into `metadata_in`)
  - `is_monthly` (boolean cast)

## Correlation and Concurrency

- Lane-scoped advisory transaction lock is used to serialize competing events on the same lane.
- For CARD-first then delayed LPD in the same lane and correlation window, LPD updates the existing active session instead of creating a new one.
- Active identity uniqueness is enforced at DB level (`plate`, `card_uid`, `etag_epc`) for sessions where `time_out IS NULL`.

## Error Mapping

- `422`: missing required controller fields, invalid payload, lane module disabled, missing lane config, or validation/business rule failures.
- `409`: duplicate active identity (DB unique conflict `23505`).
- `404`: lot not found (`LOT_NOT_FOUND`).
- `500`: unhandled server errors.

## Verified Test Coverage Notes

- Existing backend tests already validate lane policy, correlation behavior, and duplicate prevention in `be/__tests__/services/checkin.concurrency.test.js` and `be/__tests__/services/edge.checkin.service.test.js`.
- Integration coverage for edge endpoint now includes card-first then delayed LPD enrichment with same `session_id` assertion in `be/__tests__/integration/lpd-checkin.integration.test.js`.
