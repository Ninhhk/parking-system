const checkoutService = require("../services/checkout.service");

exports.payosWebhook = async (req, res) => {
    try {
        const result = await checkoutService.finalizeFromWebhook(req.body);
        console.log("[payos-webhook] processed", {
            orderCode: req.body?.data?.orderCode,
            code: req.body?.code,
            success: req.body?.success,
            replay: result?.replay,
            reason: result?.reason || null,
        });
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("[payos-webhook] invalid", {
            orderCode: req.body?.data?.orderCode,
            code: req.body?.code,
            success: req.body?.success,
            error: error?.message,
        });
        return res.status(400).json({
            success: false,
            message: "Invalid webhook",
        });
    }
};
