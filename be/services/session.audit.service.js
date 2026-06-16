const sessionAuditRepo = require("../repositories/session.audit.repo");
const { getPresignedUrl } = require("./minio.service");

/**
 * Derives display status from session flags.
 * Precedence: is_lost → "Lost Ticket", time_out set → "Completed", else → "Active"
 */
function deriveSessionStatus(session) {
    if (session.is_lost) return "Lost Ticket";
    if (session.time_out) return "Completed";
    return "Active";
}

/**
 * Fetches paginated, filtered audit sessions with presigned image URLs.
 *
 * @param {Object} params - Filter and pagination parameters
 * @returns {Promise<Object>} { sessions, pagination } or throws on validation error
 */
async function getAuditSessions({ plate, sessionId, cardUid, startDate, endDate, vehicleType, lotId, status, page = 1, pageSize = 20 }) {
    // Validate lot existence when lotId is provided
    if (lotId) {
        const exists = await sessionAuditRepo.lotExists(lotId);
        if (!exists) {
            const error = new Error("Parking lot not found");
            error.status = 422;
            throw error;
        }
    }

    const { rows, totalCount } = await sessionAuditRepo.findSessions({
        plate,
        sessionId,
        cardUid,
        startDate,
        endDate,
        vehicleType,
        lotId,
        status,
        page,
        pageSize,
    });

    // Generate presigned URLs and derive status for each session
    const sessions = await Promise.all(
        rows.map(async (row) => {
            const [imageInUrl, imageOutUrl] = await Promise.all([
                row.image_in_url ? getPresignedUrl(row.image_in_url) : null,
                row.image_out_url ? getPresignedUrl(row.image_out_url) : null,
            ]);

            return {
                session_id: row.session_id,
                license_plate: row.license_plate,
                card_uid: row.card_uid,
                vehicle_type: row.vehicle_type,
                is_monthly: row.is_monthly,
                lot_name: row.lot_name,
                time_in: row.time_in,
                time_out: row.time_out,
                parking_fee: row.parking_fee,
                status: deriveSessionStatus(row),
                image_in_url: imageInUrl,
                image_out_url: imageOutUrl,
            };
        })
    );

    const totalPages = Math.ceil(totalCount / pageSize) || 0;

    return {
        sessions,
        pagination: {
            page,
            pageSize,
            totalCount,
            totalPages,
        },
    };
}

module.exports = { deriveSessionStatus, getAuditSessions };
