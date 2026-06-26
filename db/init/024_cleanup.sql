-- 024_cleanup: Remove confirmed-dead database objects
-- Idempotent — all statements use IF EXISTS

-- 1. Remove unused column from edge_events
-- 'next_retry_at' is never read or written by any repo/service/controller.
-- Flagged by codebase audit (WS8 cleanup).
ALTER TABLE edge_events DROP COLUMN IF EXISTS next_retry_at;

-- 2. Remove unused index on payment_attempts
-- No repo query uses WHERE session_id on payment_attempts; Payment Intent V2
-- routes through intent_id instead.
-- Flagged by codebase audit (WS8 cleanup).
DROP INDEX IF EXISTS idx_payment_attempts_session_status_created;
