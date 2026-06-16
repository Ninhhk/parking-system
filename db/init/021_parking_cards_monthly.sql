-- 021_parking_cards_monthly.sql
-- Add monthly subscription columns to parking_cards.
-- A card with is_monthly=true AND monthly_end_date >= today is treated as a monthly card
-- (lazy expiry — no background job needed).
-- Idempotent: safe to re-apply.

ALTER TABLE parking_cards
    ADD COLUMN IF NOT EXISTS is_monthly BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE parking_cards
    ADD COLUMN IF NOT EXISTS monthly_end_date DATE;
