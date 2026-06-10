-- 015_parking_cards.sql
-- Pool-card registry for issued-card casual entry mode.
-- Cards are managed via the Card Pool admin UI (no SQL seed; real UIDs only).

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
