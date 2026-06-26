-- 020_kiosk_input_reset.sql
--
-- Adds the kiosk input auto-clear grace duration to the gate_settings singleton.
-- Controls how long the RFID input keeps a failed/old value before clearing and
-- refocusing on the check-in/check-out terminals.
-- Idempotent: ADD COLUMN IF NOT EXISTS with a NOT NULL default.

ALTER TABLE gate_settings
    ADD COLUMN IF NOT EXISTS kiosk_input_reset_seconds INTEGER NOT NULL DEFAULT 2;
