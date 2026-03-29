const checkoutService = require("../services/checkout.service");

const toIntentResponse = (result = {}) => ({
    ...result,
    intent_status: result.intent_status || result.status || result.intent?.status || "NOT_FOUND",
    intent: result.intent || null,
    active_attempt: result.active_attempt || null,
});

exports.createIntent = async (req, res) => {
    try {
        const sessionId = Number(req.params.session_id);
        const requestedAmount = Number(req.body.amount);
        const idempotencyKey = req.body.idempotency_key;

        if (!Number.isInteger(sessionId) || sessionId <= 0) {
            return res.status(422).json({
                success: false,
                message: "Session ID is required",
            });
        }

        const result = await checkoutService.createIntent({
            sessionId,
            paymentMethod: "CARD",
            requestedAmount: Number.isFinite(requestedAmount) ? requestedAmount : undefined,
            idempotencyKey,
            forceNew: false,
        });

        return res.status(201).json({
            success: true,
            data: toIntentResponse(result),
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

exports.regenerateIntent = async (req, res) => {
    try {
        const sessionId = Number(req.params.session_id);
        const requestedAmount = Number(req.body.amount);
        const idempotencyKey = req.body.idempotency_key;

        if (!Number.isInteger(sessionId) || sessionId <= 0) {
            return res.status(422).json({
                success: false,
                message: "Session ID is required",
            });
        }

        if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
            return res.status(422).json({
                success: false,
                message: "idempotency_key is required",
            });
        }

        const result = await checkoutService.createIntent({
            sessionId,
            paymentMethod: "CARD",
            requestedAmount: Number.isFinite(requestedAmount) ? requestedAmount : undefined,
            idempotencyKey,
            forceNew: true,
        });

        return res.status(201).json({
            success: true,
            data: toIntentResponse(result),
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
        if (!Number.isInteger(sessionId) || sessionId <= 0) {
            return res.status(422).json({
                success: false,
                message: "Session ID is required",
            });
        }

        const result = await checkoutService.getPaymentStatus({ sessionId });
        return res.status(200).json({
            success: true,
            data: toIntentResponse(result),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payment status",
        });
    }
};
