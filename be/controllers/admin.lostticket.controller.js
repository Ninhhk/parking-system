const lostticketRepo = require("../repositories/admin.lostticket.repo");
const { getPresignedUrl } = require("../services/minio.service");
const { isBase64Image } = require("../services/image.upload.helper");
const sessionsRepo = require("../repositories/employee.sessions.repo");
const parkingCardsRepo = require("../repositories/parkingCards.repo");

// Get lost ticket reports (paginated)
exports.getAllLostTicketReports = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const pageSize = parseInt(req.query.pageSize, 10) || 20;
        const { q } = req.query;

        const result = await lostticketRepo.getLostTicketReports({ page, pageSize, q });

        return res.status(200).json({
            success: true,
            data: {
                reports: result.rows,
                pagination: result.pagination,
            },
        });
    } catch (error) {
        console.error("Get lost ticket reports error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// Get lost ticket report by ID
exports.getLostTicketReportById = async (req, res) => {
    const { id } = req.params;
    try {
        const report = await lostticketRepo.getLostTicketReportById(id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Lost ticket report not found",
            });
        }

        // Resolve guest_identification to presigned URL if it's a MinIO object key
        if (report.guest_identification && !isBase64Image(report.guest_identification)) {
            const url = await getPresignedUrl(report.guest_identification);
            if (url) {
                report.guest_identification = url;
            }
        } else if (report.guest_identification && report.guest_identification.startsWith("data:application/octet-stream")) {
            // Normalize broken MIME so <img> can render it
            report.guest_identification = report.guest_identification.replace(
                "data:application/octet-stream",
                "data:image/jpeg"
            );
        }

        res.status(200).json({
            success: true,
            data: report,
        });
    } catch (error) {
        console.error("Get lost ticket report by ID error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.deleteLostTicketReport = async (req, res) => {
    const { id } = req.params;
    try {
        // Look up the report first to get session_id for card reset
        const report = await lostticketRepo.getLostTicketReportById(id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Lost ticket report not found",
            });
        }

        const deleted = await lostticketRepo.deleteLostTicketReport(id);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Lost ticket report not found",
            });
        }

        // Clear session is_lost flag
        await sessionsRepo.clearLostTicketStatus(report.session_id);

        // Reset pool card back to available (best-effort, symmetric with reportLostTicket)
        try {
            const card_uid = report.card_uid || null;
            if (card_uid) {
                await parkingCardsRepo.markAvailableIfLost(card_uid);
            }
        } catch (cardErr) {
            console.error(JSON.stringify({ event: "pool_card_reset_failed", session_id: report.session_id }));
        }

        res.status(200).json({
            success: true,
            message: "Lost ticket report deleted successfully",
        });
    } catch (error) {
        console.error("Delete lost ticket report error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}