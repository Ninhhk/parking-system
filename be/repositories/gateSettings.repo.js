const { pool } = require("../config/db");

exports.getSettings = async () => {
    const result = await pool.query(
        `SELECT auto_close_duration_seconds, kiosk_input_reset_seconds FROM gate_settings WHERE id = 1`
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
};

exports.upsertSettings = async (durationSeconds, kioskInputResetSeconds) => {
    const result = await pool.query(
        `INSERT INTO gate_settings (id, auto_close_duration_seconds, kiosk_input_reset_seconds, updated_at)
         VALUES (1, $1, $2, NOW())
         ON CONFLICT (id) DO UPDATE
             SET auto_close_duration_seconds = $1,
                 kiosk_input_reset_seconds = $2,
                 updated_at = NOW()
         RETURNING auto_close_duration_seconds, kiosk_input_reset_seconds, updated_at`,
        [durationSeconds, kioskInputResetSeconds]
    );
    return result.rows[0];
};
