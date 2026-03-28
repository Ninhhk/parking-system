const checkoutService = require("../services/checkout.service");

exports.payosWebhook = async (req, res) => {
    try {
        await checkoutService.finalizeFromWebhook(req.body);
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid webhook",
        });
    }
};
