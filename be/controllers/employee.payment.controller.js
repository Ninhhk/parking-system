const checkoutService = require("../services/checkout.service");

exports.createIntent = async (req, res) => {
    try {
        const sessionId = Number(req.params.session_id);
        const requestedAmount = Number(req.body.amount);

        if (!sessionId) {
            return res.status(422).json({
                success: false,
                message: "Session ID is required",
            });
        }

        const result = await checkoutService.createIntent({
            sessionId,
            paymentMethod: "CARD",
            requestedAmount: Number.isFinite(requestedAmount) ? requestedAmount : undefined,
        });

        return res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

exports.getPaymentStatus = async (req, res) => {
    try {
        const sessionId = Number(req.params.session_id);
        if (!sessionId) {
            return res.status(422).json({
                success: false,
                message: "Session ID is required",
            });
        }

        const result = await checkoutService.getPaymentStatus({ sessionId });
        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payment status",
        });
    }
};
