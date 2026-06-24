const { pool } = require("../config/db");

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Fetch lost ticket reports with pagination
exports.getLostTicketReports = async ({ page, pageSize, q } = {}) => {
    const normalizedPage = Number.isInteger(page) && page > 0 ? page : DEFAULT_PAGE;
    const normalizedPageSize = Number.isInteger(pageSize) && pageSize > 0
        ? Math.min(pageSize, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;
    const offset = (normalizedPage - 1) * normalizedPageSize;

    const conditions = [];
    const params = [];

    if (q && q.trim()) {
        params.push(`%${q.trim()}%`);
        const idx = params.length;
        conditions.push(`(
            ps.license_plate ILIKE $${idx}
            OR CAST(ps.session_id AS text) ILIKE $${idx}
            OR ltr.guest_phone ILIKE $${idx}
        )`);
    }

    params.push(normalizedPageSize);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT ps.*, ltr.*, COUNT(*) OVER() AS total_count
        FROM LostTicketReport ltr
        JOIN ParkingSessions ps ON ltr.session_id = ps.session_id
        WHERE 1=1 ${whereClause}
        ORDER BY ltr.reportid DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await pool.query(query, params);
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;

    return {
        rows: result.rows.map(({ total_count, ...row }) => row),
        pagination: {
            page: normalizedPage,
            pageSize: normalizedPageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / normalizedPageSize),
        },
    };
};

exports.getLostTicketReportById = async (id) => {
    const query = `
        SELECT ps.*, ltr.*
        FROM LostTicketReport ltr
        JOIN ParkingSessions ps ON ltr.session_id = ps.session_id
        WHERE ltr.reportid = $1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
};

exports.deleteLostTicketReport = async (id) => {
    const query = `
        DELETE FROM LostTicketReport
        WHERE reportid = $1;
    `;
    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
}