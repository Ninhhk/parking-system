-- 016_parking_cards_global_uid.sql
-- Migrate parking_cards to a global card identity model:
--   PK (lot_id, card_uid) -> PK (card_uid); lot_id becomes nullable (NULL = shared card).
-- Safe and idempotent. Do NOT edit 015_parking_cards.sql.
DO $$
DECLARE
    pk_name   TEXT;
    pk_cols   TEXT;
    dup_count INT;
BEGIN
    -- (a) Table missing: cannot determine prior migration state -> fail safe (Req 7.7)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'parking_cards'
    ) THEN
        RAISE EXCEPTION 'parking_cards missing; cannot determine prior migration state';
    END IF;

    -- Determine the current primary key (name + ordered column list)
    SELECT con.conname,
           string_agg(att.attname, ',' ORDER BY att.attnum)
      INTO pk_name, pk_cols
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN unnest(con.conkey) AS k(attnum) ON TRUE
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = k.attnum
    WHERE rel.relname = 'parking_cards' AND con.contype = 'p'
    GROUP BY con.conname;

    -- (b) Already at target state (PK = card_uid) -> nothing to do (Req 7.6 idempotent)
    IF pk_cols = 'card_uid' THEN
        RETURN;
    END IF;

    -- (c) PK is not the expected shape -> cannot determine state -> fail safe (Req 7.7)
    IF pk_cols IS DISTINCT FROM 'lot_id,card_uid' AND pk_cols IS DISTINCT FROM 'card_uid,lot_id' THEN
        RAISE EXCEPTION 'Unexpected primary key (%) on parking_cards; aborting', pk_cols;
    END IF;

    -- (d) Duplicate card_uid across lots -> cannot make card_uid the PK -> fail safe (Req 7.5)
    SELECT COUNT(*) INTO dup_count FROM (
        SELECT card_uid FROM parking_cards GROUP BY card_uid HAVING COUNT(*) > 1
    ) d;
    IF dup_count > 0 THEN
        RAISE EXCEPTION 'Duplicate card_uid across lots (% offenders); aborting global-UID migration', dup_count;
    END IF;

    -- (e) Apply the change: drop old PK, make lot_id nullable, set new PK on card_uid.
    --     Existing rows are preserved (only constraints change) (Req 7.1, 7.2, 7.4).
    EXECUTE format('ALTER TABLE parking_cards DROP CONSTRAINT %I', pk_name);
    ALTER TABLE parking_cards ALTER COLUMN lot_id DROP NOT NULL;
    ALTER TABLE parking_cards ADD CONSTRAINT parking_cards_pkey PRIMARY KEY (card_uid);
END $$;
