const { getAuditSessions } = require("../services/session.audit.service");

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/employee/audit/sessions
 * Returns paginated, filtered audit sessions.
 */
exports.getAuditSessions = async (req, res) => {
    try {
        const { plate, cardUid, startDate, endDate, vehicleType, lotId, status, q } = req.query;
        const page = req.query.page ? parseInt(req.query.page, 10) : 1;
        const pageSize = req.query.pageSize ? parseInt(req.query.pageSize, 10) : 20;

        // Validate plate (optional, but if provided must be 1-20 non-whitespace-only chars)
        if (plate !== undefined) {
            if (typeof plate !== "string" || plate.trim().length === 0 || plate.length > 20) {
                return res.status(422).json({
                    success: false,
                    message: "Invalid license plate query. Must be 1–20 characters and not whitespace-only.",
                });
            }
        }

        // Validate cardUid (optional, but if provided must be 1-100 non-whitespace-only chars)
        if (cardUid !== undefined) {
            if (typeof cardUid !== "string" || cardUid.trim().length === 0 || cardUid.length > 100) {
                return res.status(422).json({
                    success: false,
                    message: "Invalid card UID query. Must be 1–100 characters and not whitespace-only.",
                });
            }
        }

        // Validate sessionId (optional, but if provided must be a positive integer)
        let parsedSessionId;
        if (req.query.sessionId !== undefined) {
            parsedSessionId = parseInt(req.query.sessionId, 10);
            if (isNaN(parsedSessionId) || !Number.isInteger(parsedSessionId) || parsedSessionId < 1) {
                return res.status(422).json({
                    success: false,
                    message: "Session ID must be a positive integer",
                });
            }
        }

        // Validate pageSize
        if (isNaN(pageSize) || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
            return res.status(422).json({
                success: false,
                message: "Page size must be between 1 and 100",
            });
        }

        // Validate page
        if (isNaN(page) || !Number.isInteger(page) || page < 1) {
            return res.status(422).json({
                success: false,
                message: "Page must be a positive integer",
            });
        }

        // Validate date formats
        if (startDate !== undefined && !DATE_REGEX.test(startDate)) {
            return res.status(422).json({
                success: false,
                message: "Invalid date format. Expected YYYY-MM-DD",
            });
        }
        if (endDate !== undefined && !DATE_REGEX.test(endDate)) {
            return res.status(422).json({
                success: false,
                message: "Invalid date format. Expected YYYY-MM-DD",
            });
        }

        // Validate startDate <= endDate
        if (startDate && endDate && startDate > endDate) {
            return res.status(422).json({
                success: false,
                message: "Start date must not be later than end date",
            });
        }

        // Parse lotId to integer if provided
        const parsedLotId = lotId ? parseInt(lotId, 10) : undefined;

        // Validate status (optional, must be one of allowed values)
        const ALLOWED_STATUSES = ["active", "completed", "lost_ticket"];
        if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
            return res.status(422).json({
                success: false,
                message: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(", ")}`,
            });
        }

        const result = await getAuditSessions({
            plate,
            sessionId: parsedSessionId,
            cardUid,
            startDate,
            endDate,
            vehicleType,
            lotId: parsedLotId,
            status,
            q,
            page,
            pageSize,
            requesterRole: req.session?.user?.role,
            requesterId: req.session?.user?.user_id,
        });

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("Session audit error:", error);
        const status = error.status || 500;
        return res.status(status).json({
            success: false,
            message: error.status ? error.message : "Internal server error",
        });
    }
};
