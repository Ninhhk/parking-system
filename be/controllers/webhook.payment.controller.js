const checkoutService = require("../services/checkout.service");

exports.payosWebhook = async (req, res) => {
    try {
        const result = await checkoutService.finalizeFromWebhook(req.body);
        console.log(
            JSON.stringify({
                event: "payos_webhook_received",
                order_code: req.body?.data?.orderCode || null,
                webhook_event_id: req.body?.data?.reference || req.body?.signature || null,
                result,
            })
        );
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.log(
            JSON.stringify({
                event: "payos_webhook_invalid",
                order_code: req.body?.data?.orderCode || null,
                webhook_event_id: req.body?.data?.reference || req.body?.signature || null,
                error: error.message,
            })
        );
        return res.status(200).json({ success: true, data: { ok: true, replay: true, reason: "INVALID_WEBHOOK" } });
    }
};
