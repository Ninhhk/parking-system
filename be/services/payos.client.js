const { PayOS } = require("@payos/node");

let payOS;

const getPayOS = () => {
    if (!payOS) {
        payOS = new PayOS({
            clientId: process.env.PAYOS_CLIENT_ID,
            apiKey: process.env.PAYOS_API_KEY,
            checksumKey: process.env.PAYOS_CHECKSUM_KEY,
        });
    }
    return payOS;
};

exports.createPaymentLink = async (payload) => getPayOS().paymentRequests.create(payload);
exports.verifyWebhook = (payload) => getPayOS().webhooks.verify(payload);
