const { pool } = require("../config/db");

exports.getSettings = async () => {
    const result = await pool.query(
        `SELECT auto_close_duration_seconds FROM gate_settings WHERE id = 1`
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
};

exports.upsertSettings = async (durationSeconds) => {
    const result = await pool.query(
        `INSERT INTO gate_settings (id, auto_close_duration_seconds, updated_at)
         VALUES (1, $1, NOW())
         ON CONFLICT (id) DO UPDATE
             SET auto_close_duration_seconds = $1,
                 updated_at = NOW()
         RETURNING auto_close_duration_seconds, updated_at`,
        [durationSeconds]
    );
    return result.rows[0];
};
