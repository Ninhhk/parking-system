const payosClient = require("./payos.client");

exports.createPaymentLink = async (payload, _options = {}) => {
    return payosClient.createPaymentLink(payload);
};

exports.verifyWebhook = async (payload) => payosClient.verifyWebhook(payload);
