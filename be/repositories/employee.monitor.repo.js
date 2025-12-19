const { pool } = require('../config/db'); // Corrected import path for pool

exports.getMyLot = async (user_id) => {
    const query = `
        SELECT 
            pl.lot_id, pl.lot_name, pl.car_capacity, pl.bike_capacity,
            pl.current_car, pl.current_bike,
            u.username as manager_username
        FROM ParkingLots pl
        LEFT JOIN Users u ON pl.managed_by = u.user_id
        WHERE u.user_id = $1`; // Fixed table alias for Users
    const result = await pool.query(query, [user_id]);
    return result.rows[0];
};

exports.getMyParkingSessions = async (user_id) => {
    const getMyLotQuery = `
        SELECT lot_id FROM ParkingLots WHERE managed_by = $1
    `;
    const lotResult = await pool.query(getMyLotQuery, [user_id]);

    if (lotResult.rows.length === 0) {
        return []; // Return empty array if no lot is managed by the user
    }

    const query = `
        SELECT * FROM ParkingSessions WHERE lot_id = $1 AND time_out IS NULL
    `;
    const result = await pool.query(query, [lotResult.rows[0].lot_id]);
    return result.rows;
};
