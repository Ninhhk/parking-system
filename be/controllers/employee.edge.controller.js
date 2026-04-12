const edgeCheckinService = require("../services/edge.checkin.service");

const REQUIRED_FIELDS = ["lane_id", "trigger_type", "vehicle_type", "lot_id"];

function getMissingFields(payload = {}) {
    return REQUIRED_FIELDS.filter((field) => {
        const value = payload[field];
        return value === undefined || value === null || value === "";
    });
}

function isValidationOrBusinessError(error) {
    if (!error) {
        return false;
    }

    return error.status === 422 || error.statusCode === 422 || error.code === "VALIDATION_ERROR";
}

exports.ingestCheckinEvent = async (req, res) => {
    try {
        const missingFields = getMissingFields(req.body);
        if (missingFields.length > 0) {
            return res.status(422).json({
                success: false,
                message: `${missingFields[0]} is required`,
            });
        }

        const session = await edgeCheckinService.ingestCheckinEvent(req.body);
        return res.status(201).json({
            success: true,
            message: "Edge check-in event ingested successfully",
            session,
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "Duplicate active identity",
            });
        }

        if (error.code === "LOT_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: error.message || "Parking lot not found",
            });
        }

        if (isValidationOrBusinessError(error)) {
            return res.status(422).json({
                success: false,
                message: error.publicMessage || "Invalid edge check-in payload",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
