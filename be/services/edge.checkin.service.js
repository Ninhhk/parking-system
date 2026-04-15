const { pool } = require("../config/db");
const sessionsRepo = require("../repositories/employee.sessions.repo");
const edgeGatewaysConfig = require("../config/edge_gateways.json");

const DEFAULT_CORRELATION_WINDOW_SECONDS = 5;

function toValidationError(publicMessage) {
    const error = new Error(publicMessage);
    error.status = 422;
    error.code = "VALIDATION_ERROR";
    error.publicMessage = publicMessage;
    return error;
}

function toBusinessError(status, code, publicMessage) {
    const error = new Error(publicMessage);
    error.status = status;
    error.code = code;
    error.publicMessage = publicMessage;
    return error;
}

function normalizeTriggerType(triggerType) {
    if (typeof triggerType !== "string") {
        return "";
    }

    return triggerType.trim().toUpperCase();
}

function getLanePolicy(gatewayId, laneId) {
    const gateways = Array.isArray(edgeGatewaysConfig?.gateways)
        ? edgeGatewaysConfig.gateways
        : [];

    const gateway = gateways.find((item) => item && item.gateway_id === gatewayId);
    if (!gateway) {
        return null;
    }

    const lanes = Array.isArray(gateway.lanes) ? gateway.lanes : [];
    return lanes.find((lane) => lane && lane.lane_id === laneId) || null;
}

function getLaneLockKeys(gatewayId, laneId) {
    return {
        gatewayLockKey: stableAdvisoryKey("gateway", gatewayId),
        laneLockKey: stableAdvisoryKey("lane", laneId),
    };
}

function stableAdvisoryKey(namespace, value) {
    const text = `${namespace}:${value || ""}`;
    let hash = 2166136261;

    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash | 0;
}

function getCorrelationWindowSeconds(lanePolicy) {
    const value = lanePolicy?.correlation_window_seconds;
    if (Number.isInteger(value) && value > 0) {
        return value;
    }

    return DEFAULT_CORRELATION_WINDOW_SECONDS;
}

exports.ingestCheckinEvent = async (event) => {
    const gatewayId = event?.gateway_id;
    const laneId = event?.lane_id;
    const lotId = event?.lot_id;
    const vehicleType = event?.vehicle_type;
    const triggerType = normalizeTriggerType(event?.trigger_type);

    if (!gatewayId) {
        throw toValidationError("gateway_id is required for edge check-in event");
    }

    if (!laneId) {
        throw toValidationError("lane_id is required for edge check-in event");
    }

    const lanePolicy = getLanePolicy(gatewayId, laneId);
    if (!lanePolicy) {
        throw toValidationError("Lane configuration not found");
    }

    const allowedModules = Array.isArray(lanePolicy.allowed_trigger_modules)
        ? lanePolicy.allowed_trigger_modules.map((moduleName) => normalizeTriggerType(moduleName)).filter(Boolean)
        : [];

    if (!allowedModules.includes(triggerType)) {
        throw toValidationError("Lane module disabled");
    }

    const correlationWindowSeconds = getCorrelationWindowSeconds(lanePolicy);

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const lockKeys = getLaneLockKeys(gatewayId, laneId);

        const { gatewayLockKey, laneLockKey } = lockKeys;
        await client.query("SELECT pg_advisory_xact_lock($1, $2)", [gatewayLockKey, laneLockKey]);

        if (triggerType === "LPD") {
            const enriched = await sessionsRepo.enrichRecentSessionByLane({
                entry_lane_id: laneId,
                license_plate: event.license_plate || null,
                image_in_url: event.image_in_url || null,
                metadata_patch: event.metadata || {},
                window_seconds: correlationWindowSeconds,
            }, { client });

            if (enriched) {
                await client.query("COMMIT");
                return enriched;
            }

            if (!lotId || !vehicleType) {
                throw toValidationError("lot_id and vehicle_type are required when LPD event needs session creation");
            }
        } else if (!lotId || !vehicleType) {
            throw toValidationError("lot_id and vehicle_type are required for non-LPD check-in events");
        }

        const created = await sessionsRepo.startSession({
            lot_id: lotId,
            license_plate: event.license_plate || null,
            card_uid: event.card_uid || null,
            etag_epc: event.etag_epc || null,
            entry_lane_id: laneId,
            image_in_url: event.image_in_url || null,
            metadata_in: event.metadata || {},
            vehicle_type: vehicleType,
            is_monthly: !!event.is_monthly,
        }, { client });

        if (!created) {
            throw toBusinessError(
                409,
                "LOT_CAPACITY_FULL",
                `Parking lot is full for ${String(vehicleType).toLowerCase()}s`
            );
        }

        await client.query("COMMIT");
        return created;
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (_rollbackError) {
        }
        throw error;
    } finally {
        client.release();
    }
};
