-- 014_casual_entry_mode.sql
-- Adds per-lot casual entry mode column to parkinglots.
-- Values: 'session_ticket' (default) or 'issued_card'.

ALTER TABLE parkinglots
    ADD COLUMN IF NOT EXISTS casual_entry_mode VARCHAR(20) NOT NULL DEFAULT 'session_ticket';

ALTER TABLE parkinglots
    DROP CONSTRAINT IF EXISTS chk_casual_entry_mode;

ALTER TABLE parkinglots
    ADD CONSTRAINT chk_casual_entry_mode
    CHECK (casual_entry_mode IN ('session_ticket', 'issued_card'));
