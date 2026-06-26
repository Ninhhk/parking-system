const { pool } = require("../config/db");

/**
 * Find sessions with dynamic filters, pagination, and total count.
 * Uses COUNT(*) OVER() window function to get total in a single query.
 */
exports.findSessions = async ({ plate, sessionId, cardUid, startDate, endDate, vehicleType, lotId, status, q, page, pageSize }) => {
    const offset = (page - 1) * pageSize;

    const query = `
        SELECT ps.*, pl.lot_name,
               COUNT(*) OVER() AS total_count
        FROM parkingsessions ps
        JOIN parkinglots pl ON ps.lot_id = pl.lot_id
        WHERE 1=1
          AND ($1::text IS NULL OR ps.license_plate ILIKE '%' || $1 || '%')
          AND ($2::date IS NULL OR ps.time_in >= $2::date)
          AND ($3::date IS NULL OR ps.time_in < ($3::date + INTERVAL '1 day'))
          AND ($4::text IS NULL OR LOWER(ps.vehicle_type) = LOWER($4))
          AND ($5::int IS NULL OR ps.lot_id = $5)
          AND ($6::int IS NULL OR ps.session_id = $6)
          AND ($7::text IS NULL OR ps.card_uid ILIKE '%' || $7 || '%')
          AND (
            $10::text IS NULL
            OR ($10 = 'active' AND ps.is_lost = false AND ps.time_out IS NULL)
            OR ($10 = 'completed' AND ps.is_lost = false AND ps.time_out IS NOT NULL)
            OR ($10 = 'lost_ticket' AND ps.is_lost = true)
          )
          AND (
            $11::text IS NULL
            OR ps.license_plate ILIKE '%' || $11 || '%'
            OR CAST(ps.session_id AS text) ILIKE '%' || $11 || '%'
            OR ps.card_uid ILIKE '%' || $11 || '%'
            OR ps.vehicle_type ILIKE '%' || $11 || '%'
            OR pl.lot_name ILIKE '%' || $11 || '%'
          )
        ORDER BY ps.time_in DESC
        LIMIT $8 OFFSET $9
    `;

    const params = [
        plate || null,
        startDate || null,
        endDate || null,
        vehicleType || null,
        lotId || null,
        sessionId || null,
        cardUid || null,
        pageSize,
        offset,
        status || null,
        q && q.trim() ? q.trim() : null,
    ];

    const result = await pool.query(query, params);

    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;

    return {
        rows: result.rows,
        totalCount,
    };
};

/**
 * Check if a parking lot exists by lot_id.
 */
exports.lotExists = async (lotId) => {
    const result = await pool.query(
        "SELECT 1 FROM parkinglots WHERE lot_id = $1",
        [lotId]
    );
    return result.rowCount > 0;
};

/**
 * Resolve the lot_id managed by a given user, or null if they manage none.
 */
exports.getManagedLotId = async (userId) => {
    const result = await pool.query(
        "SELECT lot_id FROM parkinglots WHERE managed_by = $1",
        [userId]
    );
    return result.rows[0]?.lot_id ?? null;
};
