CREATE TABLE IF NOT EXISTS payment_attempts (
    attempt_id BIGSERIAL PRIMARY KEY,
    session_id INT NOT NULL,
    sub_id INT,
    provider VARCHAR(50) NOT NULL DEFAULT 'PAYOS',
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    provider_order_code VARCHAR(100),
    provider_transaction_id VARCHAR(100),
    qr_code_url TEXT,
    checkout_url TEXT,
    expires_at TIMESTAMP,
    webhook_payload JSONB,
    failure_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_payment_attempts_session
        FOREIGN KEY (session_id)
        REFERENCES parkingsessions(session_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_payment_attempts_sub
        FOREIGN KEY (sub_id)
        REFERENCES monthlysubs(sub_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_payment_attempt_status
        CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempts_provider_order_code
    ON payment_attempts(provider_order_code)
    WHERE provider_order_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_session_status_created
    ON payment_attempts(session_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_session_id
    ON payment(session_id)
    WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_session_plate
    ON parkingsessions(license_plate)
    WHERE time_out IS NULL;
