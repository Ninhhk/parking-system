const crypto = require("crypto");
const { EDGE_INGEST_API_KEY } = require("../config/constants");

const areApiKeysEqual = (providedApiKey, expectedApiKey) => {
    if (!providedApiKey || !expectedApiKey) {
        return false;
    }

    const providedBuffer = Buffer.from(String(providedApiKey));
    const expectedBuffer = Buffer.from(String(expectedApiKey));
    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

exports.requireEdgeApiKey = (req, res, next) => {
    const providedApiKey = req.get("x-edge-api-key");
    if (!areApiKeysEqual(providedApiKey, EDGE_INGEST_API_KEY)) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }

    return next();
};
