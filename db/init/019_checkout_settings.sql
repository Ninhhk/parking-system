-- 019_checkout_settings.sql
-- Singleton table for checkout settings (admin-configurable default payment method).
-- Idempotent: IF NOT EXISTS + ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS checkout_settings (
    id                       INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    default_payment_method   TEXT NOT NULL DEFAULT 'CARD'
        CHECK (default_payment_method IN ('CARD', 'CASH')),
    updated_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default row
INSERT INTO checkout_settings (id, default_payment_method)
VALUES (1, 'CARD')
ON CONFLICT (id) DO NOTHING;
