const { pool } = require("../config/db");

/**
 * Find an active monthly subscription by card UID.
 * Active = start_date <= today AND end_date >= today.
 *
 * NOTE: Related to employee.sessions.repo#checkMonthlySubByCard, which serves the
 * RFID check-in path and additionally filters by vehicle_type. This lookup is for
 * the kiosk's vehicle-type auto-resolve (the card alone determines the subscription).
 */
exports.findActiveByCardUid = async (cardUid) => {
    const query = `
        SELECT sub_id, vehicle_type, owner_name, start_date, end_date
        FROM monthlysubs
        WHERE card_uid = $1
          AND start_date <= CURRENT_DATE
          AND end_date >= CURRENT_DATE
        LIMIT 1
    `;

    const result = await pool.query(query, [cardUid]);
    return result.rows[0] || null;
};
