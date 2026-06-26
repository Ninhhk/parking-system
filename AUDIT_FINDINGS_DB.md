# Database Schema Audit Findings

**Generated:** 2025-01-XX (Task 1.4 — codebase-cleanup spec)

**Scope:** `db/init/*.sql` (001–023) cross-referenced against `be/repositories/*.js`

---

## Summary

| Category | Count |
|----------|-------|
| Tables scanned | 17 (excl. dropped `monthlysubs`) |
| Columns scanned | ~120 |
| Indexes scanned | 21 |
| Redundant Tables | 0 |
| Redundant Columns | 2 |
| Unused Indexes | 1 |
| FK-Blocked Candidates | 0 |

---

## Redundant Tables

| Table | Defining Migration | Category | Evidence | Blocking Constraints |
|-------|-------------------|----------|----------|---------------------|
| *(none found)* | — | — | — | — |

All 17 active tables are referenced in at least one repository file's SQL strings. The `monthlysubs` table was already properly dropped in `023_drop_monthlysubs.sql`.

---

## Redundant Columns

| Column | Parent Table | Defining Migration | Category | Evidence | Blocking Constraints |
|--------|-------------|-------------------|----------|----------|---------------------|
| `next_retry_at` | `edge_events` | `008_edge_events.sql` | CONFIRMED_DEAD | Never read or written by any repository, service, or controller code. Only exists in DDL. No `SELECT next_retry_at`, no `UPDATE ... SET next_retry_at`, no code path accesses this field. | None |
| `metadata_out` | `parkingsessions` | `007_hybrid_edge_checkin.sql` | SUSPICIOUS | Never explicitly read or written in any repository SQL. Returned implicitly via `SELECT *` in multiple repos but never accessed by any service/controller logic. Only referenced in a schema-structure integration test (`checkin.concurrency.test.js`). Likely placeholder for future checkout image enrichment. | None |

---

## Unused Indexes

| Index | Table | Covered Columns | Defining Migration | Category | Evidence | Blocking Constraints |
|-------|-------|----------------|-------------------|----------|----------|---------------------|
| `idx_payment_attempts_session_status_created` | `payment_attempts` | `(session_id, status, created_at DESC)` | `003_payment_attempts.sql` | CONFIRMED_DEAD | No repository query uses `WHERE session_id = $X` on `payment_attempts`. All current queries filter by `intent_id`, `attempt_id`, or `provider_order_code`. The Payment Intent V2 architecture routes through `intent_id` (indexed separately via `idx_payment_attempts_intent_id`), making this session-based composite index dead. | None |

### Indexes reviewed but NOT flagged (still in use)

| Index | Reason kept |
|-------|------------|
| `idx_sessions_lot_timeout` | Used by `WHERE lot_id = $1 AND time_out IS NULL` in 3+ repo functions |
| `idx_sessions_license_plate` | Supports ILIKE searches in `session.audit.repo.js` and `admin.lostticket.repo.js` (leading-wildcard won't use it, but planner may still choose for `= $1` in `findActiveByPlate` on closed sessions — borderline, kept) |
| `uq_active_session_plate` | Enforces unique active session per plate; used by `findActiveByPlate` WHERE clause |
| `uq_active_session_card_uid` | Enforces unique active session per card; used by `findActiveByCardUid` |
| `uq_active_session_etag_epc` | Enforces unique active session per eTag; used by `findActiveByEtagEpc` |
| `idx_active_session_entry_lane_timein` | Used by `enrichRecentSessionByLane` (entry_lane_id + time_in DESC + time_out IS NULL) |
| `idx_payment_date` | Used by `admin.payment.repo.js` (WHERE payment_date >= / <) and `admin.analytics.repo.js` |
| `idx_notifications_user` | Supports JOIN on `Notifications.user_id = Users.user_id` |
| `uq_payment_attempts_provider_order_code` | Used by `getByProviderOrderCode` (WHERE provider_order_code) |
| `uq_payment_session_id` | Enforces unique session in payment ledger; used by ON CONFLICT in `paymentLedger.repo.js` |
| `uq_payment_intents_active_session` | Enforces at most one active intent per session (constraint) |
| `idx_payment_intents_session_status_created` | Used by `getActiveBySessionForUpdate` (session_id + status filter + ORDER BY created_at DESC) |
| `uq_payment_intents_idempotency` | Prevents duplicate intents (constraint enforcement) |
| `idx_payment_attempts_intent_id` | Used by `markSupersededByIntent` and `getActiveAttemptByIntentId` (WHERE intent_id) |
| `idx_edge_events_status_occurred_at` | Used by `listEvents` (WHERE status + ORDER BY occurred_at DESC) |
| `idx_edge_events_lane_id_occurred_at` | Used by `listEvents` (WHERE lane_id + ORDER BY occurred_at DESC) |
| `idx_fee_config_versions_vehicle_effective` | Used by `getActiveConfig` (WHERE vehicle_type + ORDER BY effective_from DESC) |
| `uq_cameras_active_lane_dir_purpose` | Enforces one active camera per lane/direction/purpose (constraint) |
| `idx_cameras_lane_active` | Used by `findActivePlateCameraByLane` (WHERE lane_id + is_active) |

---

## FK-Blocked Candidates

| Object | Type | Blocking Constraint | Dependent Table | Note |
|--------|------|--------------------|--------------------|------|
| *(none)* | — | — | — | All flagged items have no inbound FK references from non-flagged tables |

**Notes:**
- `edge_events.next_retry_at` has no FK dependency; safe to DROP.
- `parkingsessions.metadata_out` has no FK dependency; safe to DROP if confirmed dead.
- `idx_payment_attempts_session_status_created` is a plain index with no FK or constraint dependency; safe to DROP.

---

## Observations & Recommendations

1. **`next_retry_at` (CONFIRMED_DEAD):** This column was likely planned for a retry scheduling mechanism that was never implemented. The actual retry logic in `edge.events.controller.js` uses `retry_count` and `max_retries` without any time-based scheduling. Safe to remove via `ALTER TABLE edge_events DROP COLUMN IF EXISTS next_retry_at`.

2. **`metadata_out` (SUSPICIOUS):** This column mirrors `metadata_in` and was added in the hybrid-edge-checkin migration. It appears designed for storing checkout-side metadata (exit image recognition results, etc.) but no code path writes to it. Keep for now unless the checkout enrichment feature is explicitly abandoned.

3. **`idx_payment_attempts_session_status_created` (CONFIRMED_DEAD):** This index was useful before Payment Intent V2 when attempts were looked up directly by session_id. After the intent-based architecture (migration 004+), all queries go through `intent_id` instead. The index costs write performance on every INSERT/UPDATE to `payment_attempts` with no read benefit. Safe to drop.
