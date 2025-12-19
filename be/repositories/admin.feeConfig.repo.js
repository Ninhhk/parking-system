const {pool} = require('../config/db')

exports.getAllFeeConfigs = async () => {
    const query = `SELECT * FROM FeeConfigs`;
    const result = await pool.query(query);
    return result.rows;
}

exports.getServiceFee = async (ticket_type, vehicle_type) => {
    const query = `SELECT * FROM FeeConfigs WHERE ticket_type = $1 AND vehicle_type = $2`;
    const result = await pool.query(query, [ticket_type, vehicle_type]);
    //console.log('ticket_type:', ticket_type);
    //console.log('vehicle_type:', vehicle_type);
    //console.log('result:', result.rows[0]);
    if (result.rows.length > 0) {
        return result.rows[0].service_fee;
    }
    return null; // Return null if no fee config found
}

exports.getPenaltyFee = async (ticket_type, vehicle_type) => {
    const query = `SELECT * FROM FeeConfigs WHERE ticket_type = $1 AND vehicle_type = $2`;
    const result = await pool.query(query, [ticket_type, vehicle_type]);
    if (result.rows.length > 0) {
        return result.rows[0].penalty_fee;
    }
    return null; // Return null if no fee config found
}

exports.createServiceFee = async (ticket_type, vehicle_type, service_fee, penalty_fee) => {
    const query = `
        INSERT INTO FeeConfigs (ticket_type, vehicle_type, service_fee, penalty_fee)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `;
    const result = await pool.query(query, [ticket_type, vehicle_type, service_fee, penalty_fee]);
    if (result.rows.length > 0) {
        return result.rows[0];
    }
    return null;
}

exports.setServiceFee = async (ticket_type, vehicle_type, service_fee, penalty_fee) => {
    const query = `
        UPDATE FeeConfigs
        SET service_fee = $1, penalty_fee = $2
        WHERE ticket_type = $3 AND vehicle_type = $4
        RETURNING *
    `;
    const result = await pool.query(query, [service_fee, penalty_fee, ticket_type, vehicle_type]);
    if (result.rows.length > 0) {
        return result.rows[0];
    }
    return null; // Return null if no rows were updated
}