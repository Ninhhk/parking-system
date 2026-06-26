-- 017_default_issued_card.sql
-- Make 'issued_card' the application-wide default casual entry mode.
--
-- This only changes the COLUMN DEFAULT (applies to lots created without an
-- explicit mode). It deliberately does NOT backfill existing rows: the
-- db-migrate runner re-applies every file on each restart, so an unconditional
-- UPDATE would clobber any lot an admin later sets to 'session_ticket'.
-- Existing lots are migrated once, out-of-band, at deploy time (see deploy notes).
--
-- Idempotent: ALTER ... SET DEFAULT is safe to run repeatedly.
ALTER TABLE parkinglots
    ALTER COLUMN casual_entry_mode SET DEFAULT 'issued_card';
