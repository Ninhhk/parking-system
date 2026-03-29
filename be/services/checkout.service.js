const { pool } = require("../config/db");
const payosClient = require("./payos.client");
const sessionRepo = require("../repositories/session.repo");
const paymentAttemptRepo = require("../repositories/paymentAttempt.repo");
const paymentLedgerRepo = require("../repositories/paymentLedger.repo");
const paymentIntentService = require("./paymentIntent.service");
const constants = require("../config/constants");
const { calculateAndValidateFee } = require("./feeCalculation.service");

exports.createIntent = async ({ sessionId, paymentMethod, requestedAmount, forceNew = false, idempotencyKey }) => {
    if (!constants.PAYMENT_INTENT_V2_ENABLED) {
        const session = await sessionRepo.getSessionForCheckout(sessionId);
        if (!session) {
            throw new Error("Session not found");
        }
        if (session.time_out) {
            throw new Error("Session already checked out");
        }

        const feeResult = calculateAndValidateFee(session);
        if (!feeResult.success) {
            throw new Error(feeResult.error || "Unable to calculate payment amount");
        }

        const amount = feeResult.totalAmount;
        if (Number.isFinite(requestedAmount) && Math.round(requestedAmount) !== Math.round(amount)) {
            throw new Error("Requested amount does not match server-calculated amount");
        }

        const attempt = await paymentAttemptRepo.createAttempt({
            sessionId,
            subId: null,
            intentId: null,
            provider: "PAYOS",
            paymentMethod,
            amount,
        });

        const orderCode = Number(attempt.attempt_id);
        const link = await payosClient.createPaymentLink({
            orderCode,
            amount: Math.round(Number(amount)),
            description: `Checkout ${sessionId}`.slice(0, 25),
            returnUrl: `${constants.PAYOS_DEFAULT_RETURN_URL}/${sessionId}`,
            cancelUrl: `${constants.PAYOS_DEFAULT_CANCEL_URL}/${sessionId}`,
        });

        const attached = await paymentAttemptRepo.attachProviderIntent({
            attemptId: attempt.attempt_id,
            providerOrderCode: String(link.orderCode || orderCode),
            qrCodeUrl: link.qrCode || null,
            checkoutUrl: link.checkoutUrl || null,
            expiresAt: link.expiredAt || null,
        });

        return {
            attempt_id: attached.attempt_id,
            provider_order_code: attached.provider_order_code,
            qr_code_url: attached.qr_code_url,
            checkout_url: attached.checkout_url,
            expires_at: attached.expires_at,
            status: attached.status,
            intent_status: attached.status,
            amount,
            service_fee: feeResult.serviceFee,
            penalty_fee: feeResult.penaltyFee,
            hours: feeResult.hours,
            intent_id: null,
            intent: null,
            active_attempt: attached,
            reused: false,
        };
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
    if (!constants.PAYMENT_INTENT_V2_ENABLED) {
        const latest = await paymentAttemptRepo.getLatestBySession(sessionId);
        if (!latest) {
            return {
                status: "NOT_FOUND",
                intent_status: "NOT_FOUND",
                intent: null,
                active_attempt: null,
            };
        }

        return {
            ...latest,
            status: latest.status || "NOT_FOUND",
            intent_status: latest.status || "NOT_FOUND",
            intent: null,
            active_attempt: latest,
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
    if (!constants.PAYMENT_INTENT_V2_ENABLED) {
        const verified = await payosClient.verifyWebhook(payload);
        const data = verified && verified.data ? verified.data : verified || {};

        const topLevelCode = String(payload?.code || "");
        const topLevelSuccess = payload?.success === true;
        const dataCode = String(data.code || "00");
        const isSuccessEvent =
            (topLevelSuccess || topLevelCode === "00") &&
            (topLevelCode === "" || topLevelCode === "00") &&
            dataCode === "00";
        const orderCode = String(data.orderCode || "");

        if (!orderCode) {
            throw new Error("Missing order code");
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            const existing = await paymentAttemptRepo.getByProviderOrderCode(orderCode, client);
            if (!existing) {
                await client.query("COMMIT");
                return { ok: true, replay: true, reason: "ATTEMPT_NOT_FOUND" };
            }

            if (existing.status === "PAID") {
                await client.query("COMMIT");
                return { ok: true, replay: true, reason: "ALREADY_PAID" };
            }

            if (!isSuccessEvent) {
                await paymentAttemptRepo.markFailedOrExpired(
                    {
                        attemptId: existing.attempt_id,
                        status: "FAILED",
                        failureReason: `Webhook not successful: ${verified.code || "UNKNOWN"}`,
                    },
                    client
                );
                await client.query("COMMIT");
                return { ok: true, replay: false, reason: "NON_SUCCESS_EVENT" };
            }

            const attempt = await paymentAttemptRepo.markPaidByOrderCode(
                {
                    providerOrderCode: orderCode,
                    providerTransactionId: data.reference || null,
                    webhookPayload: verified,
                },
                client
            );

            if (!attempt) {
                await client.query("COMMIT");
                return { ok: true, replay: true, reason: "PAID_BY_OTHER_PROCESS" };
            }

            const session = await sessionRepo.getSessionForCheckout(attempt.session_id, client);
            if (!session) {
                await client.query("COMMIT");
                return { ok: true, replay: true, reason: "SESSION_NOT_FOUND" };
            }

            const finalized = await sessionRepo.finalizeSessionIfOpen(
                {
                    sessionId: attempt.session_id,
                    totalAmount: attempt.amount,
                    isLost: !!session.is_lost,
                },
                client
            );

            if (finalized) {
                await paymentLedgerRepo.insertSettledPayment(
                    {
                        sessionId: attempt.session_id,
                        subId: attempt.sub_id,
                        paymentMethod: "CARD",
                        totalAmount: attempt.amount,
                    },
                    client
                );
                await sessionRepo.decrementLotCountAtomic(
                    { lotId: session.lot_id, vehicleType: session.vehicle_type },
                    client
                );
            }

            await client.query("COMMIT");
            return { ok: true, replay: !finalized };
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    }

    return paymentIntentService.processWebhook(payload);
};
