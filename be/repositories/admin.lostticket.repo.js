const { pool } = require('../config/db');

// Fetch all lost ticket reports
exports.getAllLostTicketReports = async () => {
    const query = `
        SELECT ps.*, ltr.*
        FROM LostTicketReport ltr
        JOIN ParkingSessions ps ON ltr.session_id = ps.session_id;
    `;
    const result = await pool.query(query);
    return result.rows;
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