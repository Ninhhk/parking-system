const {pool} = require('../config/db');
const bcrypt = require('bcrypt');

exports.findUserByUsername = async (username) => {
    const query = `
        SELECT user_id, username, full_name, password_hash, role 
        FROM users 
        WHERE username = $1
    `;
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
};

exports.createUser = async ({ username, password, full_name, role }) => {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const query = `
        INSERT INTO users (username, password_hash, full_name, role)
        VALUES ($1, $2, $3, $4)
        RETURNING user_id, username, full_name, role, created_at
    `;
    const result = await pool.query(query, [username, password_hash, full_name, role]);
    return result.rows[0];
};