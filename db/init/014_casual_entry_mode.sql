-- 014_casual_entry_mode.sql
-- Adds per-lot casual entry mode column to parkinglots.
-- Values: 'issued_card' (default) or 'session_ticket'.
-- Note: on fresh builds this ADD COLUMN backfills existing (seeded) rows with the
-- default. Already-migrated environments skip this (column exists) and instead pick
-- up the new default via 017_default_issued_card.sql.

ALTER TABLE parkinglots
    ADD COLUMN IF NOT EXISTS casual_entry_mode VARCHAR(20) NOT NULL DEFAULT 'issued_card';

ALTER TABLE parkinglots
    DROP CONSTRAINT IF EXISTS chk_casual_entry_mode;

ALTER TABLE parkinglots
    ADD CONSTRAINT chk_casual_entry_mode
    CHECK (casual_entry_mode IN ('session_ticket', 'issued_card'));
