const payosClient = require("./payos.client");

exports.createPaymentLink = async (payload, options = {}) => {
    const requestPayload = {
        ...payload,
        ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
    };

    return payosClient.createPaymentLink(requestPayload);
};

exports.verifyWebhook = (payload) => payosClient.verifyWebhook(payload);
