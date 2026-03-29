const { pool } = require("../config/db");

exports.getSessionForCheckout = async (sessionId, client = pool) => {
    const result = await client.query(
        `SELECT
            ps.*,
            fc.service_fee,
            fc.penalty_fee
         FROM parkingsessions ps
         LEFT JOIN feeconfigs fc
            ON fc.vehicle_type = ps.vehicle_type
           AND fc.ticket_type = CASE WHEN ps.is_monthly THEN 'monthly' ELSE 'daily' END
         WHERE ps.session_id = $1`,
        [sessionId]
    );
    return result.rows[0] || null;
};

exports.getSessionForCheckoutForUpdate = async (sessionId, client = pool) => {
    const result = await client.query(
        `SELECT
            ps.*,
            (
                SELECT fc.service_fee
                FROM feeconfigs fc
                WHERE fc.vehicle_type = ps.vehicle_type
                  AND fc.ticket_type = CASE WHEN ps.is_monthly THEN 'monthly' ELSE 'daily' END
                LIMIT 1
            ) AS service_fee,
            (
                SELECT fc.penalty_fee
                FROM feeconfigs fc
                WHERE fc.vehicle_type = ps.vehicle_type
                  AND fc.ticket_type = CASE WHEN ps.is_monthly THEN 'monthly' ELSE 'daily' END
                LIMIT 1
            ) AS penalty_fee
         FROM parkingsessions ps
         WHERE ps.session_id = $1
         FOR UPDATE`,
        [sessionId]
    );
    return result.rows[0] || null;
};

exports.finalizeSessionIfOpen = async ({ sessionId, totalAmount, isLost }, client) => {
    const result = await client.query(
        `UPDATE parkingsessions
         SET time_out = NOW(), parking_fee = $1, is_lost = $2
         WHERE session_id = $3 AND time_out IS NULL
         RETURNING *`,
        [totalAmount, !!isLost, sessionId]
    );
    return result.rows[0] || null;
};

exports.decrementLotCountAtomic = async ({ lotId, vehicleType }, client) => {
    const column = vehicleType.toLowerCase() === "car" ? "current_car" : "current_bike";
    await client.query(
        `UPDATE parkinglots
         SET ${column} = GREATEST(${column} - 1, 0)
         WHERE lot_id = $1`,
        [lotId]
    );
};
