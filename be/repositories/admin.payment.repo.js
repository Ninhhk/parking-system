const { pool } = require('../config/db');

exports.getAllPayments = async () => {
    const query = `SELECT * FROM Payment`;
    return await pool.query(query);
}