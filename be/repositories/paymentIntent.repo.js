const { pool } = require("../config/db");

exports.getActiveBySessionForUpdate = async (sessionId, client = pool) => {
    const result = await client.query(
        `SELECT *
         FROM payment_intents
         WHERE session_id = $1
           AND status IN ('REQUIRES_PAYMENT_METHOD', 'PENDING')
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [sessionId]
    );
    return result.rows[0] || null;
};

exports.createIntent = async (
    {
        sessionId,
        provider = "PAYOS",
        status,
        amount,
        providerIntentId,
        providerOrderCode,
        checkoutUrl,
        expiresAt,
        metadata,
    },
    client = pool
) => {
    const result = await client.query(
        `INSERT INTO payment_intents(
            session_id,
            provider,
            status,
            amount,
            provider_intent_id,
            provider_order_code,
            checkout_url,
            expires_at,
            metadata
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         RETURNING *`,
        [
            sessionId,
            provider,
            status,
            amount,
            providerIntentId || null,
            providerOrderCode || null,
            checkoutUrl || null,
            expiresAt || null,
            metadata ? JSON.stringify(metadata) : JSON.stringify({}),
        ]
    );
    return result.rows[0] || null;
};

exports.updateIntentStatus = async (
    {
        intentId,
        status,
        amount,
        providerIntentId,
        providerOrderCode,
        checkoutUrl,
        expiresAt,
        metadata,
    },
    client = pool
) => {
    const result = await client.query(
        `UPDATE payment_intents
         SET status = $1,
             amount = COALESCE($2, amount),
             provider_intent_id = COALESCE($3, provider_intent_id),
             provider_order_code = COALESCE($4, provider_order_code),
             checkout_url = COALESCE($5, checkout_url),
             expires_at = COALESCE($6, expires_at),
             metadata = COALESCE($7::jsonb, metadata),
             updated_at = NOW()
         WHERE intent_id = $8
         RETURNING *`,
        [
            status,
            amount || null,
            providerIntentId || null,
            providerOrderCode || null,
            checkoutUrl || null,
            expiresAt || null,
            metadata ? JSON.stringify(metadata) : null,
            intentId,
        ]
    );
    return result.rows[0] || null;
};

exports.setActiveAttempt = async (intentId, attemptId, client = pool) => {
    const result = await client.query(
        `UPDATE payment_intents
         SET active_attempt_id = $2,
              updated_at = NOW()
         WHERE intent_id = $1
         RETURNING *`,
        [intentId, attemptId]
    );
    return result.rows[0] || null;
};

exports.getById = async (intentId, client = pool) => {
    const result = await client.query(
        `SELECT *
         FROM payment_intents
         WHERE intent_id = $1
         LIMIT 1`,
        [intentId]
    );
    return result.rows[0] || null;
};

exports.getBySession = async (sessionId, client = pool) => {
    const result = await client.query(
        `SELECT *
         FROM payment_intents
         WHERE session_id = $1
         ORDER BY created_at DESC`,
        [sessionId]
    );
    return result.rows;
};
