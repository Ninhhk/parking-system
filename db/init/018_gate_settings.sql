-- 018_gate_settings.sql
-- Singleton table for gate control settings (admin-configurable auto-close duration).
-- Idempotent: IF NOT EXISTS + ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS gate_settings (
    id                            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    auto_close_duration_seconds   INTEGER NOT NULL DEFAULT 4
        CHECK (auto_close_duration_seconds >= 2 AND auto_close_duration_seconds <= 30),
    updated_at                    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default row
INSERT INTO gate_settings (id, auto_close_duration_seconds)
VALUES (1, 4)
ON CONFLICT (id) DO NOTHING;
