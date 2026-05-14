-- 012_payment_intent_v2_impl.sql
-- Ensures all Payment Intent V2 constraints and indexes are in place.
-- Idempotent: safe to re-run on databases that already applied 004 and 011.

-- 1. Ensure chk_payment_intents_status CHECK constraint exists with correct values
--    (Requirement 1.2: REQUIRES_PAYMENT_METHOD, PENDING, PAID, EXPIRED, CANCELED)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_payment_intents_status'
    ) THEN
        ALTER TABLE payment_intents
            ADD CONSTRAINT chk_payment_intents_status
                CHECK (status IN (
                    'REQUIRES_PAYMENT_METHOD',
                    'PENDING',
                    'PAID',
                    'EXPIRED',
                    'CANCELED'
                ));
    END IF;
END
$$;

-- 2. Ensure partial unique index: at most one active intent per session
--    (Requirement 1.4)
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_active_session
    ON payment_intents(session_id)
    WHERE status IN ('REQUIRES_PAYMENT_METHOD', 'PENDING');

-- 3. Verify chk_payment_attempt_status includes all six statuses (added in 011)
--    Re-apply only if missing to stay idempotent.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_payment_attempt_status'
    ) THEN
        ALTER TABLE payment_attempts
            ADD CONSTRAINT chk_payment_attempt_status
                CHECK (status IN ('CREATED', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'SUPERSEDED'));
    END IF;
END
$$;

-- 4. Verify uq_payment_intents_idempotency partial index exists (added in 011)
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_idempotency
    ON payment_intents(session_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 5. Verify uq_payment_session_id partial index on payment ledger (added in 011)
--    Only create if not exists; 011 drops and recreates it as partial.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'uq_payment_session_id'
    ) THEN
        CREATE UNIQUE INDEX uq_payment_session_id
            ON payment(session_id)
            WHERE session_id IS NOT NULL;
    END IF;
END
$$;
