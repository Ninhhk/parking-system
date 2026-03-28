const { pool } = require("../config/db");

exports.insertSettledPayment = async ({ sessionId, subId, paymentMethod, totalAmount }, client = pool) => {
    const result = await client.query(
        `INSERT INTO payment(session_id, sub_id, payment_method, total_amount, payment_date)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (session_id) DO NOTHING
         RETURNING *`,
        [sessionId, subId || null, paymentMethod, totalAmount]
    );
    return result.rows[0] || null;
};
