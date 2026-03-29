CREATE TABLE IF NOT EXISTS payment_intents (
    intent_id BIGSERIAL PRIMARY KEY,
    session_id INT NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'PAYOS',
    status VARCHAR(40) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    active_attempt_id BIGINT,
    provider_intent_id VARCHAR(100),
    provider_order_code VARCHAR(100),
    checkout_url TEXT,
    expires_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_payment_intents_session
        FOREIGN KEY (session_id)
        REFERENCES parkingsessions(session_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_payment_intents_status
        CHECK (status IN (
            'REQUIRES_PAYMENT_METHOD',
            'PENDING',
            'PAID',
            'EXPIRED',
            'CANCELED'
        )),
    CONSTRAINT chk_payment_intents_amount_nonnegative
        CHECK (amount >= 0)
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_payment_intents_status'
    ) THEN
        ALTER TABLE payment_intents
            DROP CONSTRAINT chk_payment_intents_status;
    END IF;

    ALTER TABLE payment_intents
        ADD CONSTRAINT chk_payment_intents_status
            CHECK (status IN (
                'REQUIRES_PAYMENT_METHOD',
                'PENDING',
                'PAID',
                'EXPIRED',
                'CANCELED'
            ));
END
$$;

ALTER TABLE payment_intents
    ADD COLUMN IF NOT EXISTS active_attempt_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.conname = 'fk_payment_intents_active_attempt'
          AND t.relname = 'payment_intents'
          AND n.nspname = current_schema()
    ) THEN
        ALTER TABLE payment_intents
            ADD CONSTRAINT fk_payment_intents_active_attempt
                FOREIGN KEY (active_attempt_id)
                REFERENCES payment_attempts(attempt_id)
                ON DELETE SET NULL
                ON UPDATE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_payment_intents_amount_nonnegative'
    ) THEN
        ALTER TABLE payment_intents
            ADD CONSTRAINT chk_payment_intents_amount_nonnegative
                CHECK (amount >= 0);
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_active_session
    ON payment_intents(session_id)
    WHERE status IN ('REQUIRES_PAYMENT_METHOD', 'PENDING');

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_provider_provider_order_code
    ON payment_intents(provider, provider_order_code)
    WHERE provider_order_code IS NOT NULL;

DROP INDEX IF EXISTS uq_payment_intents_provider_order_code;

CREATE INDEX IF NOT EXISTS idx_payment_intents_session_status_created
    ON payment_intents(session_id, status, created_at DESC);

ALTER TABLE payment_attempts
    ADD COLUMN IF NOT EXISTS intent_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.conname = 'fk_payment_attempts_intent'
          AND t.relname = 'payment_attempts'
          AND n.nspname = current_schema()
    ) THEN
        ALTER TABLE payment_attempts
            ADD CONSTRAINT fk_payment_attempts_intent
                FOREIGN KEY (intent_id)
                REFERENCES payment_intents(intent_id)
                ON DELETE SET NULL
                ON UPDATE CASCADE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_intent_id
    ON payment_attempts(intent_id);
