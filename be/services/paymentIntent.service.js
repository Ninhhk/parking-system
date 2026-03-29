const { pool } = require("../config/db");
const sessionRepo = require("../repositories/session.repo");
const paymentIntentRepo = require("../repositories/paymentIntent.repo");
const paymentAttemptRepo = require("../repositories/paymentAttempt.repo");
const payosProvider = require("./payos.provider");
const paymentLedgerRepo = require("../repositories/paymentLedger.repo");
const { calculateAndValidateFee } = require("./feeCalculation.service");
const { PAYOS_DEFAULT_RETURN_URL, PAYOS_DEFAULT_CANCEL_URL } = require("../config/constants");
const paymentMetrics = require("../observability/payment.metrics");

const toAttemptProjection = (attempt) => {
    if (!attempt) {
        return null;
    }

    return {
        attempt_id: attempt.attempt_id,
        status: attempt.status,
        provider_order_code: attempt.provider_order_code || null,
        checkout_url: attempt.checkout_url || null,
        qr_code_url: attempt.qr_code_url || null,
        expires_at: attempt.expires_at || null,
    };
};

const toIntentProjection = (intent) => {
    if (!intent) {
        return null;
    }

    return {
        intent_id: intent.intent_id,
        session_id: intent.session_id,
        status: intent.status,
        amount: intent.amount,
        active_attempt_id: intent.active_attempt_id || null,
        provider: intent.provider,
    };
};

const buildPayOSPayload = ({ sessionId, amount, orderCode }) => ({
    orderCode,
    amount: Math.round(Number(amount)),
    description: `Checkout ${sessionId}`.slice(0, 25),
    returnUrl: `${PAYOS_DEFAULT_RETURN_URL}/${sessionId}`,
    cancelUrl: `${PAYOS_DEFAULT_CANCEL_URL}/${sessionId}`,
});

const resolveActiveAttempt = async ({ intent, client }) => {
    if (!intent) {
        return null;
    }

    if (intent.active_attempt_id) {
        return paymentAttemptRepo.getById(intent.active_attempt_id, client);
    }

    return paymentAttemptRepo.getActiveAttemptByIntentId(intent.intent_id, client);
};

exports.createOrReuseIntent = async ({
    sessionId,
    paymentMethod = "CARD",
    forceNew = false,
    requestedAmount,
    idempotencyKey,
}) => {
    let pending = null;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const session = await sessionRepo.getSessionForCheckoutForUpdate(sessionId, client);
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

        let intent = await paymentIntentRepo.getActiveBySessionForUpdate(sessionId, client);

        if (intent && !forceNew) {
            const activeAttempt = await resolveActiveAttempt({ intent, client });
            if (
                activeAttempt &&
                activeAttempt.status === "PENDING" &&
                activeAttempt.provider_order_code &&
                activeAttempt.checkout_url &&
                (!activeAttempt.expires_at || new Date(activeAttempt.expires_at) > new Date()) &&
                Math.round(Number(activeAttempt.amount || intent.amount || 0)) === Math.round(Number(amount || 0))
            ) {
                await client.query("COMMIT");
                paymentMetrics.increment("reuse_intent");
                console.log(
                    JSON.stringify({
                        event: "reuse_intent",
                        session_id: sessionId,
                        intent_id: intent.intent_id,
                        attempt_id: activeAttempt.attempt_id,
                        order_code: activeAttempt.provider_order_code || null,
                    })
                );
                return {
                    reused: true,
                    intent: toIntentProjection(intent),
                    active_attempt: toAttemptProjection(activeAttempt),
                    amount,
                    service_fee: feeResult.serviceFee,
                    penalty_fee: feeResult.penaltyFee,
                    hours: feeResult.hours,
                };
            }
        }

        if (!intent) {
            intent = await paymentIntentRepo.createIntent(
                {
                    sessionId,
                    provider: "PAYOS",
                    status: "PENDING",
                    amount,
                    metadata: { paymentMethod },
                },
                client
            );
        }

        const attempt = await paymentAttemptRepo.createAttempt(
            {
                sessionId,
                subId: null,
                intentId: intent.intent_id,
                provider: intent.provider || "PAYOS",
                paymentMethod,
                amount,
            },
            client
        );

        await paymentAttemptRepo.attachProviderIntent(
            {
                attemptId: attempt.attempt_id,
                providerOrderCode: String(attempt.attempt_id),
                qrCodeUrl: null,
                checkoutUrl: null,
                expiresAt: null,
            },
            client
        );

        pending = {
            amount,
            feeResult,
            intentId: intent.intent_id,
            attemptId: attempt.attempt_id,
            providerOrderCode: String(attempt.attempt_id),
            sessionId,
            paymentMethod,
            idempotencyKey:
                typeof idempotencyKey === "string" && idempotencyKey.trim()
                    ? idempotencyKey.trim()
                    : `pi-${intent.intent_id}-attempt-${attempt.attempt_id}`,
            reused: false,
        };
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

    let link;
    try {
        link = await payosProvider.createPaymentLink(
            buildPayOSPayload({
                sessionId: pending.sessionId,
                amount: pending.amount,
                orderCode: Number(pending.providerOrderCode),
            }),
            { idempotencyKey: pending.idempotencyKey }
        );
    } catch (error) {
        const failClient = await pool.connect();
        try {
            await failClient.query("BEGIN");
            await paymentAttemptRepo.markFailedOrExpired(
                {
                    attemptId: pending.attemptId,
                    status: "FAILED",
                    failureReason: `Provider link creation failed: ${error.message}`,
                },
                failClient
            );
            await paymentIntentRepo.updateIntentStatus(
                {
                    intentId: pending.intentId,
                    status: "REQUIRES_PAYMENT_METHOD",
                },
                failClient
            );
            await failClient.query("COMMIT");
        } catch (innerError) {
            await failClient.query("ROLLBACK");
        } finally {
            failClient.release();
        }
        throw error;
    }

    const writeClient = await pool.connect();
    try {
        await writeClient.query("BEGIN");

        const attached = await paymentAttemptRepo.attachProviderIntent(
            {
                attemptId: pending.attemptId,
                providerOrderCode: String(link.orderCode || pending.providerOrderCode || pending.attemptId),
                qrCodeUrl: link.qrCode || null,
                checkoutUrl: link.checkoutUrl || null,
                expiresAt: link.expiredAt || null,
            },
            writeClient
        );

        let intent = await paymentIntentRepo.setActiveAttempt(pending.intentId, attached.attempt_id, writeClient);
        intent = await paymentIntentRepo.updateIntentStatus(
            {
                intentId: pending.intentId,
                status: "PENDING",
                amount: pending.amount,
                providerOrderCode: attached.provider_order_code,
                checkoutUrl: attached.checkout_url,
                expiresAt: attached.expires_at,
                metadata: {
                    paymentMethod: pending.paymentMethod,
                    idempotencyKey: pending.idempotencyKey,
                },
            },
            writeClient
        );

        await paymentAttemptRepo.markSupersededByIntent(pending.intentId, attached.attempt_id, writeClient);

        await writeClient.query("COMMIT");

        paymentMetrics.increment("create_intent");
        if (forceNew) {
            paymentMetrics.increment("regenerate");
        }
        console.log(
            JSON.stringify({
                event: forceNew ? "regenerate" : "create_intent",
                session_id: pending.sessionId,
                intent_id: pending.intentId,
                attempt_id: attached.attempt_id,
                order_code: attached.provider_order_code || null,
            })
        );

        return {
            reused: pending.reused,
            intent: toIntentProjection(intent),
            active_attempt: toAttemptProjection(attached),
            amount: pending.amount,
            service_fee: pending.feeResult.serviceFee,
            penalty_fee: pending.feeResult.penaltyFee,
            hours: pending.feeResult.hours,
        };
    } catch (error) {
        await writeClient.query("ROLLBACK");

        const failClient = await pool.connect();
        try {
            await failClient.query("BEGIN");
            await paymentAttemptRepo.markFailedOrExpired(
                {
                    attemptId: pending.attemptId,
                    status: "FAILED",
                    failureReason: `Persisting provider checkout state failed: ${error.message}`,
                },
                failClient
            );
            await paymentIntentRepo.updateIntentStatus(
                {
                    intentId: pending.intentId,
                    status: "REQUIRES_PAYMENT_METHOD",
                },
                failClient
            );
            await failClient.query("COMMIT");
        } catch (innerError) {
            await failClient.query("ROLLBACK");
        } finally {
            failClient.release();
        }

        throw error;
    } finally {
        writeClient.release();
    }
};

exports.getPaymentStatus = async ({ intentId, sessionId }) => {
    let intent = null;
    if (intentId) {
        intent = await paymentIntentRepo.getById(intentId);
    } else if (sessionId) {
        const intents = await paymentIntentRepo.getBySession(sessionId);
        intent = intents[0] || null;
    }

    if (!intent) {
        return {
            intent: null,
            active_attempt: null,
        };
    }

    const activeAttempt = intent.active_attempt_id
        ? await paymentAttemptRepo.getById(intent.active_attempt_id)
        : await paymentAttemptRepo.getActiveAttemptByIntentId(intent.intent_id);

    return {
        intent: toIntentProjection(intent),
        active_attempt: toAttemptProjection(activeAttempt),
    };
};

exports.processWebhook = async (payload) => {
    const startedAt = Date.now();
    const webhookEventId = payload?.data?.reference || payload?.signature || null;
    const verified = await payosProvider.verifyWebhook(payload);
    const data = verified && verified.data ? verified.data : verified || {};

    const topLevelCode = String(payload?.code || "");
    const topLevelSuccess = payload?.success === true;
    const dataCode = String(data.code || "00");
    const isSuccessEvent = (topLevelSuccess || topLevelCode === "00") && (topLevelCode === "" || topLevelCode === "00") && dataCode === "00";
    const orderCode = String(data.orderCode || "");

    if (!orderCode) {
        throw new Error("Missing order code");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const attempt = await paymentAttemptRepo.getByProviderOrderCode(orderCode, client);
        if (!attempt) {
            await client.query("COMMIT");
            paymentMetrics.increment("webhook_replay");
            console.log(
                JSON.stringify({
                    event: "webhook_replay",
                    reason: "ATTEMPT_NOT_FOUND",
                    order_code: orderCode,
                    webhook_event_id: webhookEventId,
                })
            );
            return { ok: true, replay: true, reason: "ATTEMPT_NOT_FOUND" };
        }

        const intent = attempt.intent_id ? await paymentIntentRepo.getById(attempt.intent_id, client) : null;
        if (!intent) {
            await client.query("COMMIT");
            paymentMetrics.increment("webhook_replay");
            console.log(
                JSON.stringify({
                    event: "webhook_replay",
                    reason: "INTENT_NOT_FOUND",
                    session_id: attempt.session_id,
                    attempt_id: attempt.attempt_id,
                    order_code: orderCode,
                    webhook_event_id: webhookEventId,
                })
            );
            return { ok: true, replay: true, reason: "INTENT_NOT_FOUND" };
        }

        if (!intent.active_attempt_id || Number(intent.active_attempt_id) !== Number(attempt.attempt_id)) {
            await client.query("COMMIT");
            paymentMetrics.increment("webhook_replay");
            console.log(
                JSON.stringify({
                    event: "webhook_replay",
                    reason: "ATTEMPT_NOT_ACTIVE",
                    session_id: intent.session_id,
                    intent_id: intent.intent_id,
                    attempt_id: attempt.attempt_id,
                    order_code: orderCode,
                    webhook_event_id: webhookEventId,
                })
            );
            return { ok: true, replay: true, reason: "ATTEMPT_NOT_ACTIVE" };
        }

        if (attempt.status === "PAID" || intent.status === "PAID") {
            await client.query("COMMIT");
            paymentMetrics.increment("webhook_replay");
            console.log(
                JSON.stringify({
                    event: "webhook_replay",
                    reason: "ALREADY_PAID",
                    session_id: intent.session_id,
                    intent_id: intent.intent_id,
                    attempt_id: attempt.attempt_id,
                    order_code: orderCode,
                    webhook_event_id: webhookEventId,
                })
            );
            return { ok: true, replay: true, reason: "ALREADY_PAID" };
        }

        if (!isSuccessEvent) {
            await paymentAttemptRepo.markFailedOrExpired(
                {
                    attemptId: attempt.attempt_id,
                    status: "FAILED",
                    failureReason: `Webhook not successful: ${payload?.code || "UNKNOWN"}`,
                },
                client
            );
            await paymentIntentRepo.updateIntentStatus(
                {
                    intentId: intent.intent_id,
                    status: "REQUIRES_PAYMENT_METHOD",
                },
                client
            );
            await client.query("COMMIT");
            paymentMetrics.increment("webhook_failed");
            console.log(
                JSON.stringify({
                    event: "webhook_failed",
                    reason: "NON_SUCCESS_EVENT",
                    session_id: intent.session_id,
                    intent_id: intent.intent_id,
                    attempt_id: attempt.attempt_id,
                    order_code: orderCode,
                    webhook_event_id: webhookEventId,
                })
            );
            return { ok: true, replay: false, reason: "NON_SUCCESS_EVENT" };
        }

        const markedPaid = await paymentAttemptRepo.markPaidByOrderCode(
            {
                providerOrderCode: orderCode,
                providerTransactionId: data.reference || null,
                webhookPayload: verified,
            },
            client
        );

        if (!markedPaid) {
            await client.query("COMMIT");
            paymentMetrics.increment("webhook_replay");
            console.log(
                JSON.stringify({
                    event: "webhook_replay",
                    reason: "PAID_BY_OTHER_PROCESS",
                    session_id: intent.session_id,
                    intent_id: intent.intent_id,
                    attempt_id: attempt.attempt_id,
                    order_code: orderCode,
                    webhook_event_id: webhookEventId,
                })
            );
            return { ok: true, replay: true, reason: "PAID_BY_OTHER_PROCESS" };
        }

        const session = await sessionRepo.getSessionForCheckout(markedPaid.session_id, client);
        if (!session) {
            await client.query("COMMIT");
            paymentMetrics.increment("webhook_replay");
            console.log(
                JSON.stringify({
                    event: "webhook_replay",
                    reason: "SESSION_NOT_FOUND",
                    session_id: markedPaid.session_id,
                    intent_id: intent.intent_id,
                    attempt_id: markedPaid.attempt_id,
                    order_code: orderCode,
                    webhook_event_id: webhookEventId,
                })
            );
            return { ok: true, replay: true, reason: "SESSION_NOT_FOUND" };
        }

        const finalized = await sessionRepo.finalizeSessionIfOpen(
            {
                sessionId: markedPaid.session_id,
                totalAmount: markedPaid.amount,
                isLost: !!session.is_lost,
            },
            client
        );

        if (finalized) {
            await paymentLedgerRepo.insertSettledPayment(
                {
                    sessionId: markedPaid.session_id,
                    subId: markedPaid.sub_id,
                    paymentMethod: "CARD",
                    totalAmount: markedPaid.amount,
                },
                client
            );
            await sessionRepo.decrementLotCountAtomic(
                { lotId: session.lot_id, vehicleType: session.vehicle_type },
                client
            );
        }

        await paymentIntentRepo.updateIntentStatus(
            {
                intentId: intent.intent_id,
                status: "PAID",
                amount: markedPaid.amount,
            },
            client
        );

        await client.query("COMMIT");
        paymentMetrics.increment("webhook_success");
        if (!finalized) {
            paymentMetrics.increment("webhook_replay");
        }
        paymentMetrics.observe("finalize_latency", Date.now() - startedAt);
        console.log(
            JSON.stringify({
                event: finalized ? "webhook_success" : "webhook_replay",
                session_id: markedPaid.session_id,
                intent_id: intent.intent_id,
                attempt_id: markedPaid.attempt_id,
                order_code: orderCode,
                webhook_event_id: webhookEventId,
                finalize_latency_ms: Date.now() - startedAt,
            })
        );
        return { ok: true, replay: !finalized };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
