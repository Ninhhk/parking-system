WITH candidate_attempts AS (
    SELECT
        pa.*,
        ROW_NUMBER() OVER (
            PARTITION BY pa.session_id
            ORDER BY pa.created_at DESC, pa.attempt_id DESC
        ) AS session_rank
    FROM payment_attempts pa
    WHERE pa.intent_id IS NULL
), inserted AS (
    INSERT INTO payment_intents (
        session_id,
        provider,
        status,
        amount,
        metadata,
        created_at,
        updated_at
    )
    SELECT
        c.session_id,
        COALESCE(c.provider, 'PAYOS'),
        CASE
            WHEN c.status = 'PAID' THEN 'PAID'
            WHEN c.status = 'PENDING' AND c.session_rank = 1 THEN 'PENDING'
            WHEN c.status = 'PENDING' THEN 'EXPIRED'
            WHEN c.status = 'FAILED' THEN 'CANCELED'
            WHEN c.status = 'EXPIRED' THEN 'EXPIRED'
            ELSE 'REQUIRES_PAYMENT_METHOD'
        END,
        c.amount,
        jsonb_build_object('backfilled', true, 'source_attempt_id', c.attempt_id),
        c.created_at,
        c.updated_at
    FROM candidate_attempts c
    WHERE NOT EXISTS (
        SELECT 1
        FROM payment_intents pi
        WHERE pi.metadata ->> 'source_attempt_id' = c.attempt_id::text
    )
    RETURNING intent_id
)
SELECT COUNT(*) FROM inserted;

UPDATE payment_attempts pa
SET intent_id = pi.intent_id
FROM payment_intents pi
WHERE pa.intent_id IS NULL
  AND pi.metadata ->> 'source_attempt_id' = pa.attempt_id::text;

UPDATE payment_intents pi
SET active_attempt_id = latest.attempt_id,
    updated_at = NOW()
FROM (
    SELECT DISTINCT ON (pa.intent_id)
        pa.intent_id,
        pa.attempt_id
    FROM payment_attempts pa
    WHERE pa.intent_id IS NOT NULL
      AND pa.status = 'PENDING'
    ORDER BY pa.intent_id, pa.created_at DESC, pa.attempt_id DESC
) latest
WHERE pi.intent_id = latest.intent_id
  AND (pi.active_attempt_id IS NULL OR pi.active_attempt_id <> latest.attempt_id);
