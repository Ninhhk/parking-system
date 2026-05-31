-- 015_parking_cards.sql
-- Pool-card registry for issued-card casual entry mode.
-- Cards are SQL-seeded; no admin CRUD UI in scope.

CREATE TABLE IF NOT EXISTS parking_cards (
    card_uid   VARCHAR(100) NOT NULL,
    lot_id     INT          NOT NULL REFERENCES parkinglots(lot_id) ON DELETE CASCADE,
    status     VARCHAR(20)  NOT NULL DEFAULT 'available',
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lot_id, card_uid)
);

-- Idempotent CHECK constraint for status values
ALTER TABLE parking_cards
    DROP CONSTRAINT IF EXISTS chk_parking_cards_status;

ALTER TABLE parking_cards
    ADD CONSTRAINT chk_parking_cards_status
    CHECK (status IN ('available', 'lost'));

-- Seed demo pool cards for lot_id=1
INSERT INTO parking_cards (card_uid, lot_id, status)
VALUES
    ('POOL-001', 1, 'available'),
    ('POOL-002', 1, 'available'),
    ('POOL-003', 1, 'available'),
    ('POOL-004', 1, 'available'),
    ('POOL-005', 1, 'available')
ON CONFLICT DO NOTHING;
