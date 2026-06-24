-- 022_card_holders.sql
-- Card holder identity: 1 card -> 0..1 holder.
-- Descriptive fields (license_plate, vehicle_type) are for identity/reporting only,
-- not read by any decision path (check-in uses parkingsessions.license_plate).
-- Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS card_holders (
    card_uid      VARCHAR(100) PRIMARY KEY
                  REFERENCES parking_cards(card_uid) ON DELETE CASCADE,
    holder_name   VARCHAR(255) NOT NULL,
    holder_phone  VARCHAR(20)  NOT NULL,
    license_plate VARCHAR(20),
    vehicle_type  VARCHAR(50),
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
