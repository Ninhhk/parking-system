-- 010_add_card_uid_to_monthly_subs.sql
-- Adds card_uid column to MonthlySubs to support RFID-based subscription lookup.
-- Required for Bug 2 fix: checkMonthlySubByCard queries by card_uid.
ALTER TABLE MonthlySubs ADD COLUMN IF NOT EXISTS card_uid VARCHAR(255);
