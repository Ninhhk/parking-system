const { pool } = require("../config/db");

exports.insertSettledPayment = async ({ sessionId, paymentMethod, totalAmount }, client = pool) => {
    const result = await client.query(
        `INSERT INTO payment(session_id, payment_method, total_amount, payment_date)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (session_id) WHERE session_id IS NOT NULL DO NOTHING
         RETURNING *`,
        [sessionId, paymentMethod, totalAmount]
    );
    return result.rows[0] || null;
};

exports.insertLedger = async ({ sessionId, amount, provider, providerOrderCode, paymentMethod }, client = pool) => {
    const result = await client.query(
        `INSERT INTO payment(session_id, payment_method, total_amount, payment_date)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (session_id) WHERE session_id IS NOT NULL DO NOTHING
         RETURNING *`,
        [sessionId, paymentMethod || provider || "CARD", amount]
    );
    return result.rows[0] || null;
};
