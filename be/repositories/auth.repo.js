const {pool} = require('../config/db');

exports.findUserByUsername = async (username) => {
    const query = `
        SELECT user_id, username, full_name, password_hash, role 
        FROM users 
        WHERE username = $1
    `;
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
}