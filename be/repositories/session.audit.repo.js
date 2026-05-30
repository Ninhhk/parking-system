const { pool } = require("../config/db");

/**
 * Find sessions with dynamic filters, pagination, and total count.
 * Uses COUNT(*) OVER() window function to get total in a single query.
 */
exports.findSessions = async ({ plate, startDate, endDate, vehicleType, lotId, page, pageSize }) => {
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
        ORDER BY ps.time_in DESC
        LIMIT $6 OFFSET $7
    `;

    const params = [
        plate || null,
        startDate || null,
        endDate || null,
        vehicleType || null,
        lotId || null,
        pageSize,
        offset,
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
