const { pool } = require("../config/db");
const payosClient = require("./payos.client");
const sessionRepo = require("../repositories/session.repo");
const paymentAttemptRepo = require("../repositories/paymentAttempt.repo");
const paymentLedgerRepo = require("../repositories/paymentLedger.repo");
const { PAYOS_DEFAULT_RETURN_URL, PAYOS_DEFAULT_CANCEL_URL } = require("../config/constants");

exports.createIntent = async ({ sessionId, paymentMethod, amount }) => {
    const session = await sessionRepo.getSessionForCheckout(sessionId);
    if (!session) {
        throw new Error("Session not found");
    }
    if (session.time_out) {
        throw new Error("Session already checked out");
    }

    const attempt = await paymentAttemptRepo.createAttempt({
        sessionId,
        subId: null,
        provider: "PAYOS",
        paymentMethod,
        amount,
    });

    const orderCode = Number(`${Date.now()}`.slice(-9));
    const payosPayload = {
        orderCode,
        amount: Math.round(Number(amount)),
        description: `Checkout ${sessionId}`.slice(0, 25),
        returnUrl: `${PAYOS_DEFAULT_RETURN_URL}/${sessionId}`,
        cancelUrl: `${PAYOS_DEFAULT_CANCEL_URL}/${sessionId}`,
    };

    const link = await payosClient.createPaymentLink(payosPayload);

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
    };
};

exports.getPaymentStatus = async ({ sessionId }) => {
    const latest = await paymentAttemptRepo.getLatestBySession(sessionId);
    return latest || { status: "NOT_FOUND" };
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
    const verified = payosClient.verifyWebhook(payload);
    const data = verified.data || {};
    const isSuccessEvent =
        verified.success === true &&
        String(verified.code || "") === "00" &&
        String(data.code || "00") === "00";
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
};
