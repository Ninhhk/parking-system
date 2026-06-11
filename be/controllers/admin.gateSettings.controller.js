const gateSettingsService = require("../services/admin.gateSettings.service");

const getGateSettings = async (req, res) => {
    try {
        const data = await gateSettingsService.getGateSettings();
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Get gate settings error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const updateGateSettings = async (req, res) => {
    try {
        const { auto_close_duration_seconds } = req.body;
        const result = await gateSettingsService.updateGateSettings(auto_close_duration_seconds);

        if (!result.success) {
            return res.status(result.status).json({
                success: false,
                message: "Validation failed",
                errors: [result.error],
            });
        }

        res.status(200).json({
            success: true,
            message: "Gate settings updated",
            data: result.data,
        });
    } catch (error) {
        console.error("Update gate settings error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    getGateSettings,
    updateGateSettings,
};
