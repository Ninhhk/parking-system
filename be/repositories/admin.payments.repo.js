const {pool} = require('../config/db')

exports.createMonthlyPayment = async (data) => {
    const {
        sub_id,
        payment_date,
        payment_method,
        total_amount
    } = data;

    const query = `
        INSERT INTO Payment (
            sub_id,
            payment_date,
            payment_method,
            total_amount
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
    `;

    const result = await pool.query(query,[
        sub_id,
        payment_date,
        payment_method,
        total_amount
    ]);
    return result.rows[0];
}