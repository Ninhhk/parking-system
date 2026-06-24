const { pool } = require("../config/db");

exports.getSessionsForExport = async ({ from, to }) => {
    const query = `
        SELECT session_id, lot_id, license_plate, card_uid, etag_epc, entry_lane_id,
               vehicle_type, time_in, time_out, image_in_url, image_out_url,
               is_lost, is_monthly, parking_fee
        FROM parkingsessions
        WHERE ($1::date IS NULL OR time_in >= $1::date)
          AND ($2::date IS NULL OR time_in < ($2::date + INTERVAL '1 day'))
        ORDER BY time_in DESC`;
    return (await pool.query(query, [from || null, to || null])).rows;
};

exports.getPaymentsForExport = async ({ from, to }) => {
    const query = `
        SELECT payment_id, session_id, payment_date,
               payment_method, total_amount
        FROM payment
        WHERE ($1::date IS NULL OR payment_date >= $1::date)
          AND ($2::date IS NULL OR payment_date < ($2::date + INTERVAL '1 day'))
        ORDER BY payment_date DESC`;
    return (await pool.query(query, [from || null, to || null])).rows;
};

exports.getCardsForExport = async () => {
    const query = `
        SELECT pc.card_uid, pc.lot_id, pc.status
        FROM parking_cards pc
        ORDER BY pc.card_uid`;
    return (await pool.query(query)).rows;
};

exports.getSubsForExport = async () => {
    const query = `
        SELECT pc.card_uid, pc.monthly_end_date,
               ch.holder_name, ch.holder_phone, ch.license_plate, ch.vehicle_type
        FROM parking_cards pc
        LEFT JOIN card_holders ch ON ch.card_uid = pc.card_uid
        WHERE pc.is_monthly = true
        ORDER BY pc.card_uid`;
    return (await pool.query(query)).rows;
};
