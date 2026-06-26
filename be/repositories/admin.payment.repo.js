const { pool } = require("../config/db");

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Fetch payments with server-side pagination, optional date filter, and search.
 * Uses COUNT(*) OVER() to get total in a single query.
 */
exports.getPayments = async ({ page, pageSize, from, to, q }) => {
    const normalizedPage = Number.isInteger(page) && page > 0 ? page : DEFAULT_PAGE;
    const normalizedPageSize = Number.isInteger(pageSize) && pageSize > 0
        ? Math.min(pageSize, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;
    const offset = (normalizedPage - 1) * normalizedPageSize;

    const conditions = [];
    const params = [];

    if (from) {
        params.push(from);
        conditions.push(`p.payment_date >= $${params.length}::date`);
    }
    if (to) {
        params.push(to);
        conditions.push(`p.payment_date < ($${params.length}::date + INTERVAL '1 day')`);
    }
    if (q && q.trim()) {
        params.push(`%${q.trim()}%`);
        const idx = params.length;
        conditions.push(`(
            CAST(p.payment_id AS text) ILIKE $${idx}
            OR CAST(p.session_id AS text) ILIKE $${idx}
            OR p.payment_method ILIKE $${idx}
            OR CAST(p.total_amount AS text) ILIKE $${idx}
        )`);
    }

    params.push(normalizedPageSize);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT p.payment_id, p.session_id, p.payment_date,
               p.payment_method, p.total_amount,
               COUNT(*) OVER() AS total_count
        FROM payment p
        ${whereClause}
        ORDER BY p.payment_date DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await pool.query(query, params);
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;

    return {
        rows: result.rows.map(({ total_count, ...row }) => row),
        totalCount,
        page: normalizedPage,
        pageSize: normalizedPageSize,
        totalPages: Math.ceil(totalCount / normalizedPageSize),
    };
};
