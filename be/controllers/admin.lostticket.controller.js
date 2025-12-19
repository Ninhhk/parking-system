const lostticketRepo = require("../repositories/admin.lostticket.repo");

// Get all lost ticket reports
exports.getAllLostTicketReports = async (req, res) => {
    try {
        const reports = await lostticketRepo.getAllLostTicketReports();
        res.status(200).json({
            success: true,
            data: reports,
        });
    } catch (error) {
        console.error("Get lost ticket reports error:", error);
        res.status(500).json({
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
        const deleted = await lostticketRepo.deleteLostTicketReport(id);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Lost ticket report not found",
            });
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