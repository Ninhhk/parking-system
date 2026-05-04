-- 009_fee_engine.sql
-- Introduces the versioned fee configuration table for the new rule-based fee engine.
-- The legacy feeconfigs table is intentionally preserved for backward compatibility.

CREATE TABLE IF NOT EXISTS fee_config_versions (
    config_version_id    SERIAL        PRIMARY KEY,
    vehicle_type         VARCHAR(50)   NOT NULL,
    effective_from       TIMESTAMP     NOT NULL,
    rounding_strategy    VARCHAR(20)   NOT NULL DEFAULT 'ceil_hour',
    grace_period_minutes INT           NOT NULL DEFAULT 0,
    hourly_rate          DECIMAL(12,2) NOT NULL DEFAULT 0,
    daily_cap_enabled    BOOLEAN       NOT NULL DEFAULT FALSE,
    daily_cap_amount     DECIMAL(12,2) NOT NULL DEFAULT 0,
    tiered_rate_enabled  BOOLEAN       NOT NULL DEFAULT FALSE,
    tiers                JSONB         NOT NULL DEFAULT '[]',
    time_of_day_enabled  BOOLEAN       NOT NULL DEFAULT FALSE,
    time_windows         JSONB         NOT NULL DEFAULT '[]',
    penalty_fee          DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_by           INT           REFERENCES users(user_id) ON DELETE SET NULL,
    created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fee_config_versions_vehicle_effective
    ON fee_config_versions (vehicle_type, effective_from DESC);

-- Add permissions claim column to users for role-based feature access (e.g. can_edit_fees)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}';

-- Seed initial config versions equivalent to legacy feeconfigs data.
-- effective_from = epoch ensures these apply to all historical sessions.
INSERT INTO fee_config_versions
    (vehicle_type, effective_from, rounding_strategy, grace_period_minutes,
     hourly_rate, daily_cap_enabled, tiered_rate_enabled, time_of_day_enabled, penalty_fee)
VALUES
    ('car',  '1970-01-01 00:00:00', 'ceil_hour', 0, 10000, FALSE, FALSE, FALSE, 50000),
    ('bike', '1970-01-01 00:00:00', 'ceil_hour', 0,  5000, FALSE, FALSE, FALSE, 30000)
ON CONFLICT DO NOTHING;
