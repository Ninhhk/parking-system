# Migration Consolidation Candidates

> **Report-only** — no migration files were modified. These are informational notes
> for potential future consolidation (per Requirement 8.2).

## Summary

- **Total migration files scanned:** 23 (`001_schema.sql` – `023_drop_monthlysubs.sql`)
- **Consolidation candidate groups found:** 3

## Candidates

| # | File Group | Target Table(s) | DDL Types | Notes |
|---|-----------|-----------------|-----------|-------|
| 1 | `003_payment_attempts.sql`, `004_payment_intents.sql` | `payment_attempts` | CREATE TABLE (003), ALTER TABLE + CREATE INDEX (004) | 004 adds `intent_id` column and FK to `payment_attempts` immediately after 003 creates the table |
| 2 | `011_payment_intent_v2.sql`, `012_payment_intent_v2_impl.sql` | `payment_intents`, `payment_attempts`, `payment` | ALTER TABLE, DROP CONSTRAINT, CREATE INDEX, DROP INDEX | 012 re-applies the same constraints/indexes from 011 as an idempotent safety net; both files target the same three tables |
| 3 | `015_parking_cards.sql`, `016_parking_cards_global_uid.sql` | `parking_cards` | CREATE TABLE (015), ALTER TABLE (016) | 016 restructures the PK created in 015 from composite `(lot_id, card_uid)` to single `(card_uid)` |

## Detail

### Candidate 1: payment_attempts (003 → 004)

- **003** creates `payment_attempts` with its initial schema, indexes, and also touches `payment` and `parkingsessions` indexes.
- **004** adds `intent_id BIGINT` column to `payment_attempts`, adds FK `fk_payment_attempts_intent`, and creates `idx_payment_attempts_intent_id`.

Could be consolidated into a single `payment_attempts` + `payment_intents` creation file if rewriting the initial migration sequence.

### Candidate 2: payment_intents / payment_attempts / payment (011 → 012)

- **011** adds `idempotency_key` to `payment_intents`, drops/recreates `chk_payment_attempt_status` on `payment_attempts`, and drops/recreates `uq_payment_session_id` on `payment`.
- **012** re-ensures the same constraints and indexes exist (idempotent guard). It was explicitly written as a "safety net" for databases that already ran 004.

These two files are the strongest consolidation candidate — 012 is essentially a subset of 011 with `IF NOT EXISTS` wrappers.

### Candidate 3: parking_cards (015 → 016)

- **015** creates `parking_cards` with PK `(lot_id, card_uid)`.
- **016** immediately migrates the PK to `(card_uid)` alone and makes `lot_id` nullable.

Could be consolidated into a single file that creates the table directly with the final schema (`card_uid` as PK, `lot_id` nullable).

## Non-candidates (near-misses)

| File Group | Table | Why Not Adjacent |
|-----------|-------|-----------------|
| `014_casual_entry_mode.sql`, `017_default_issued_card.sql` | `parkinglots` | 015 and 016 separate them (not adjacent) |
| `018_gate_settings.sql`, `020_kiosk_input_reset.sql` | `gate_settings` | 019 separates them (not adjacent) |
| `004_payment_intents.sql`, `005_payment_intents_backfill.sql` | `payment_intents` | 005 contains only DML (INSERT/UPDATE), no DDL statements |
