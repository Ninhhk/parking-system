const {pool} = require('../config/db')

// NOTE: this function is dead code — monthlysubs table has been dropped (migration 023).
// Kept for reference; remove when confirmed unnecessary.
exports.createMonthlyPayment = async (data) => {
    const {
        payment_date,
        payment_method,
        total_amount
    } = data;

    const query = `
        INSERT INTO Payment (
            payment_date,
            payment_method,
            total_amount
        ) VALUES ($1, $2, $3)
        RETURNING *
    `;

    const result = await pool.query(query,[
        payment_date,
        payment_method,
        total_amount
    ]);
    return result.rows[0];
}