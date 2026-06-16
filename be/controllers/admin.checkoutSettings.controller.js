const checkoutSettingsService = require("../services/admin.checkoutSettings.service");

const getCheckoutSettings = async (req, res) => {
    try {
        const data = await checkoutSettingsService.getCheckoutSettings();
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Get checkout settings error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const updateCheckoutSettings = async (req, res) => {
    try {
        const { default_payment_method } = req.body;
        const result = await checkoutSettingsService.updateCheckoutSettings(default_payment_method);

        if (!result.success) {
            return res.status(result.status).json({
                success: false,
                message: "Validation failed",
                errors: [result.error],
            });
        }

        res.status(200).json({
            success: true,
            message: "Checkout settings updated",
            data: result.data,
        });
    } catch (error) {
        console.error("Update checkout settings error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    getCheckoutSettings,
    updateCheckoutSettings,
};
