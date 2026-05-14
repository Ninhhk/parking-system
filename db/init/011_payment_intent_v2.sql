-- 011_payment_intent_v2.sql
-- Fixes remaining gaps for Payment Intent V2. See .kiro/specs/payment-intent-v2/design.md.

-- 1. Add dedicated idempotency_key column to payment_intents
--    (was previously stored in metadata JSONB with no index)
ALTER TABLE payment_intents
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_idempotency
    ON payment_intents(session_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 2. Fix payment_attempts status CHECK constraint to include CREATED and SUPERSEDED
ALTER TABLE payment_attempts
    DROP CONSTRAINT IF EXISTS chk_payment_attempt_status;

ALTER TABLE payment_attempts
    ADD CONSTRAINT chk_payment_attempt_status
        CHECK (status IN ('CREATED', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'SUPERSEDED'));

-- 3. Fix uq_payment_session_id on payment (ledger) to be a partial index
--    Current non-partial index blocks NULL session_id inserts (e.g. subscription payments)
DROP INDEX IF EXISTS uq_payment_session_id;

CREATE UNIQUE INDEX uq_payment_session_id
    ON payment(session_id)
    WHERE session_id IS NOT NULL;
