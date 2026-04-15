-- 007_hybrid_edge_checkin.sql
-- Additive schema updates for hybrid edge check-in identifiers and metadata.

ALTER TABLE parkingsessions
    ALTER COLUMN license_plate DROP NOT NULL;

ALTER TABLE parkingsessions
    ADD COLUMN IF NOT EXISTS card_uid VARCHAR(100),
    ADD COLUMN IF NOT EXISTS etag_epc VARCHAR(128),
    ADD COLUMN IF NOT EXISTS entry_lane_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS image_in_url TEXT,
    ADD COLUMN IF NOT EXISTS image_out_url TEXT,
    ADD COLUMN IF NOT EXISTS metadata_in JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS metadata_out JSONB DEFAULT '{}'::jsonb;

UPDATE parkingsessions
SET metadata_in = '{}'::jsonb
WHERE metadata_in IS NULL;

UPDATE parkingsessions
SET metadata_out = '{}'::jsonb
WHERE metadata_out IS NULL;

ALTER TABLE parkingsessions
    ALTER COLUMN metadata_in SET DEFAULT '{}'::jsonb,
    ALTER COLUMN metadata_out SET DEFAULT '{}'::jsonb;

DROP INDEX IF EXISTS uq_active_session_plate;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_session_plate
    ON parkingsessions (license_plate)
    WHERE time_out IS NULL AND license_plate IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_session_card_uid
    ON parkingsessions (card_uid)
    WHERE time_out IS NULL AND card_uid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_session_etag_epc
    ON parkingsessions (etag_epc)
    WHERE time_out IS NULL AND etag_epc IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_active_session_entry_lane_timein
    ON parkingsessions (entry_lane_id, time_in DESC)
    WHERE time_out IS NULL;
