const { pool } = require("../config/db");

exports.getSettings = async () => {
    const result = await pool.query(
        `SELECT default_payment_method FROM checkout_settings WHERE id = 1`
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
};

exports.upsertSettings = async (defaultPaymentMethod) => {
    const result = await pool.query(
        `INSERT INTO checkout_settings (id, default_payment_method, updated_at)
         VALUES (1, $1, NOW())
         ON CONFLICT (id) DO UPDATE
             SET default_payment_method = $1,
                 updated_at = NOW()
         RETURNING default_payment_method, updated_at`,
        [defaultPaymentMethod]
    );
    return result.rows[0];
};
