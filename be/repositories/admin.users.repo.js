const { pool } = require('../config/db');
const bcrypt = require('bcrypt');

exports.getAllUsers = async () => {
    const query = `
        SELECT 
            user_id,
            username,
            full_name,
            password_hash,
            role,
            created_at
        FROM Users
        ORDER BY user_id
    `;
    const result = await pool.query(query);
    return result.rows;
};

exports.getAllFreeEmployees = async () => {
    const query = `
        SELECT
            user_id,
            username,
            full_name,
            role,
            created_at
        FROM Users
        WHERE role = 'employee'
        AND user_id NOT IN (
            SELECT managed_by
            FROM ParkingLots
            WHERE managed_by IS NOT NULL
        )
        ORDER BY user_id
    `;
    const result = await pool.query(query);
    return result.rows;
};

exports.getUserById = async (userId) => {
    const query = `
        SELECT 
            user_id,
            username,
            full_name,
            role,
            created_at,
            (
                SELECT lot_name 
                FROM ParkingLots 
                WHERE managed_by = Users.user_id
            ) as managing_lot
        FROM Users
        WHERE user_id = $1
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0];
};

exports.createUser = async (userData) => {
    const {
        username,
        password,
        full_name,
        role
    } = userData;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const query = `
        INSERT INTO Users (
            username,
            password_hash,
            full_name,
            role
        ) VALUES ($1, $2, $3, $4)
        RETURNING user_id, username, full_name, role, created_at
    `;
    
    const result = await pool.query(query, [
        username,
        password_hash,
        full_name,
        role
    ]);
    return result.rows[0];
};

exports.updateUser = async (userId, userData) => {
    const {
        username,
        password,
        full_name,
        role
    } = userData;

    let queryParams = [username, full_name, role, userId];
    let query;

    if (password) {
        // If password is provided, update it too
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        query = `
            UPDATE Users
            SET 
                username = $1,
                password_hash = $5,
                full_name = $2,
                role = $3
            WHERE user_id = $4
            RETURNING user_id, username, full_name, role, created_at
        `;
        queryParams.push(password_hash);
    } else {
        query = `
            UPDATE Users
            SET 
                username = $1,
                full_name = $2,
                role = $3
            WHERE user_id = $4
            RETURNING user_id, username, full_name, role, created_at
        `;
    }
    
    const result = await pool.query(query, queryParams);
    return result.rows[0];
};

exports.deleteUser = async (userId) => {
    // Check if user is managing any parking lot
    const checkQuery = `
        SELECT COUNT(*) as managing_lots
        FROM ParkingLots
        WHERE managed_by = $1
    `;
    const checkResult = await pool.query(checkQuery, [userId]);
    
    if (parseInt(checkResult.rows[0].managing_lots) > 0) {
        throw new Error('Cannot delete user who is managing parking lots');
    }

    const query = `
        DELETE FROM Users
        WHERE user_id = $1
        RETURNING user_id, username, full_name, role
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0];
};

exports.getEmployees = async () => {
    const query = `
        SELECT 
            user_id,
            username,
            full_name
        FROM Users
        WHERE role = 'employee'
        AND user_id NOT IN (
            SELECT managed_by 
            FROM ParkingLots 
            WHERE managed_by IS NOT NULL
        )
        ORDER BY username
    `;
    const result = await pool.query(query);
    return result.rows;
}; 