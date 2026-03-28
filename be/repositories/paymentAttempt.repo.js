const { pool } = require("../config/db");

exports.createAttempt = async ({ sessionId, subId, provider, paymentMethod, amount }, client = pool) => {
    const result = await client.query(
        `INSERT INTO payment_attempts(session_id, sub_id, provider, payment_method, status, amount)
         VALUES ($1, $2, $3, $4, 'PENDING', $5)
         RETURNING *`,
        [sessionId, subId || null, provider, paymentMethod, amount]
    );
    return result.rows[0];
};

exports.attachProviderIntent = async (
    { attemptId, providerOrderCode, qrCodeUrl, checkoutUrl, expiresAt },
    client = pool
) => {
    const result = await client.query(
        `UPDATE payment_attempts
         SET provider_order_code = $1,
             qr_code_url = $2,
             checkout_url = $3,
             expires_at = $4,
             updated_at = NOW()
         WHERE attempt_id = $5
         RETURNING *`,
        [providerOrderCode, qrCodeUrl || null, checkoutUrl || null, expiresAt || null, attemptId]
    );
    return result.rows[0] || null;
};

exports.getLatestBySession = async (sessionId, client = pool) => {
    const result = await client.query(
        `SELECT *
         FROM payment_attempts
         WHERE session_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [sessionId]
    );
    return result.rows[0] || null;
};

exports.getByProviderOrderCode = async (providerOrderCode, client = pool) => {
    const result = await client.query(
        `SELECT *
         FROM payment_attempts
         WHERE provider_order_code = $1
         LIMIT 1`,
        [providerOrderCode]
    );
    return result.rows[0] || null;
};

exports.markPaidByOrderCode = async ({ providerOrderCode, providerTransactionId, webhookPayload }, client = pool) => {
    const result = await client.query(
        `UPDATE payment_attempts
         SET status = 'PAID',
             provider_transaction_id = $1,
             webhook_payload = $2::jsonb,
             updated_at = NOW()
         WHERE provider_order_code = $3
         RETURNING *`,
        [providerTransactionId || null, JSON.stringify(webhookPayload), providerOrderCode]
    );
    return result.rows[0] || null;
};

exports.markFailedOrExpired = async ({ attemptId, status, failureReason }, client = pool) => {
    const result = await client.query(
        `UPDATE payment_attempts
         SET status = $1,
             failure_reason = $2,
             updated_at = NOW()
         WHERE attempt_id = $3
         RETURNING *`,
        [status, failureReason || null, attemptId]
    );
    return result.rows[0] || null;
};
