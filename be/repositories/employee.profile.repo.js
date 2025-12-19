const { pool } = require('../config/db');

exports.getMyProfile = async (id) => {
    const query = `SELECT * FROM Users WHERE user_id = $1`;
    const result = await pool.query(query, [id]);
    return result.rows[0];
};

exports.changePassword = async (id, new_password) => {
    const query = `UPDATE Users SET password_hash = $1 WHERE user_id = $2`;
    const result = await pool.query(query, [new_password, id]);
    return result.rowCount;
}