-- 023_drop_monthlysubs.sql
-- Remove the legacy monthlysubs table and all FK references to it.
-- Monthly subscription is now managed via parking_cards.is_monthly + card_holders.
-- Idempotent: safe to re-apply.

ALTER TABLE payment DROP CONSTRAINT IF EXISTS fk_payment_sub;
ALTER TABLE payment DROP COLUMN IF EXISTS sub_id;

ALTER TABLE payment_attempts DROP CONSTRAINT IF EXISTS fk_payment_attempts_sub;
ALTER TABLE payment_attempts DROP COLUMN IF EXISTS sub_id;

DROP INDEX IF EXISTS idx_monthlysubs_license_plate;
DROP TABLE IF EXISTS monthlysubs;
