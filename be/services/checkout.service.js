const { pool } = require("../config/db");
const sessionRepo = require("../repositories/session.repo");
const paymentAttemptRepo = require("../repositories/paymentAttempt.repo");
const paymentLedgerRepo = require("../repositories/paymentLedger.repo");
const paymentIntentService = require("./paymentIntent.service");
const { PAYMENT_INTENT_V2_ENABLED } = require("../config/constants");

exports.createIntent = async ({ sessionId, paymentMethod, requestedAmount, forceNew = false, idempotencyKey }) => {
    if (!PAYMENT_INTENT_V2_ENABLED) {
        throw new Error("Payment intent v2 flow is disabled");
    }

    const result = await paymentIntentService.createOrReuseIntent({
        sessionId,
        paymentMethod,
        forceNew,
        requestedAmount,
        idempotencyKey,
    });

    const intentStatus = result.intent?.status || result.active_attempt?.status || "NOT_FOUND";

    return {
        attempt_id: result.active_attempt?.attempt_id || null,
        provider_order_code: result.active_attempt?.provider_order_code || null,
        qr_code_url: result.active_attempt?.qr_code_url || null,
        checkout_url: result.active_attempt?.checkout_url || null,
        expires_at: result.active_attempt?.expires_at || null,
        status: result.active_attempt?.status || result.intent?.status || "NOT_FOUND",
        intent_status: intentStatus,
        amount: result.amount,
        service_fee: result.service_fee,
        penalty_fee: result.penalty_fee,
        hours: result.hours,
        intent_id: result.intent?.intent_id || null,
        intent: result.intent || null,
        active_attempt: result.active_attempt || null,
        reused: !!result.reused,
    };
};

exports.getPaymentStatus = async ({ sessionId }) => {
    if (!PAYMENT_INTENT_V2_ENABLED) {
        return {
            status: "NOT_FOUND",
            intent_status: "NOT_FOUND",
            intent: null,
            active_attempt: null,
        };
    }

    const result = await paymentIntentService.getPaymentStatus({ sessionId });
    if (!result.intent && !result.active_attempt) {
        return {
            status: "NOT_FOUND",
            intent_status: "NOT_FOUND",
            intent: null,
            active_attempt: null,
        };
    }

    const intentStatus = result.intent?.status || result.active_attempt?.status || "NOT_FOUND";

    return {
        ...(result.active_attempt || {}),
        status: result.active_attempt?.status || result.intent?.status || "NOT_FOUND",
        intent_status: intentStatus,
        intent: result.intent || null,
        active_attempt: result.active_attempt || null,
    };
};

exports.confirmCashCheckout = async ({ sessionId, totalAmount, isLost, paymentMethod = "CASH" }) => {
    if (paymentMethod !== "CASH") {
        throw new Error("CARD must be finalized by webhook");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const session = await sessionRepo.getSessionForCheckout(sessionId, client);
        if (!session) {
            throw new Error("Session not found");
        }

        const finalized = await sessionRepo.finalizeSessionIfOpen({ sessionId, totalAmount, isLost }, client);
        if (finalized) {
            await paymentLedgerRepo.insertSettledPayment(
                {
                    sessionId,
                    subId: null,
                    paymentMethod: "CASH",
                    totalAmount,
                },
                client
            );
            await sessionRepo.decrementLotCountAtomic(
                { lotId: session.lot_id, vehicleType: session.vehicle_type },
                client
            );
        }

        await client.query("COMMIT");
        return { ok: true, finalized: !!finalized };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

exports.finalizeFromWebhook = async (payload) => {
    return paymentIntentService.processWebhook(payload);
};
