const edgeIngestService = require("../services/edge.ingest.service");
const edgeEventsRepo = require("../repositories/edge.events.repo");
const sessionsRepo = require("../repositories/employee.sessions.repo");

const hasNonEmptyValue = (value) => String(value || "").trim().length > 0;
const ALLOWED_TRIGGER_TYPES = ["LPD", "MANUAL", "IC_CARD", "UHF_TAG"];
const ALLOWED_VEHICLE_TYPES = ["car", "bike"];

const validateIngestPayload = (body) => {
    if (!body || typeof body !== "object") {
        return "Invalid request body";
    }

    if (!body.event_id) return "event_id is required";
    if (!body.gateway_id) return "gateway_id is required";
    if (!body.lane_id) return "lane_id is required";
    if (!body.occurred_at) return "occurred_at is required";
    if (!body.lot_id) return "lot_id is required";
    if (!body.vehicle_type) return "vehicle_type is required";
    if (!body.trigger || typeof body.trigger !== "object") return "trigger.type is required";
    if (!body.trigger.type) return "trigger.type is required";

    const vehicleType = String(body.vehicle_type).trim().toLowerCase();

    if (!ALLOWED_VEHICLE_TYPES.includes(vehicleType)) {
        return "vehicle_type must be one of: car, bike";
    }

    const triggerType = String(body.trigger.type).trim().toUpperCase();

    if (!ALLOWED_TRIGGER_TYPES.includes(triggerType)) {
        return "trigger.type must be one of: LPD, MANUAL, IC_CARD, UHF_TAG";
    }

    if (Number.isNaN(Date.parse(body.occurred_at))) {
        return "occurred_at must be a valid datetime";
    }

    if (["IC_CARD", "UHF_TAG", "MANUAL"].includes(triggerType) && !hasNonEmptyValue(body.trigger.value)) {
        return `trigger.value is required for ${triggerType}`;
    }

    if (triggerType === "LPD") {
        const hasIdentity =
            hasNonEmptyValue(body.trigger.value) ||
            hasNonEmptyValue(body.trigger.plate);
        if (!hasIdentity) {
            return "LPD trigger requires trigger.value or trigger.plate";
        }
    }

    return null;
};

exports.ingestEvent = async (req, res) => {
    try {
        const validationError = validateIngestPayload(req.body);
        if (validationError) {
            return res.status(422).json({
                success: false,
                message: validationError,
            });
        }

        const result = await edgeIngestService.ingestEvent(req.body);
        const isFailed = String(result && result.status ? result.status : "").toUpperCase() === "FAILED";

        if (isFailed) {
            return res.status(422).json({
                success: false,
                message: result.action || "Ingestion failed",
                data: result,
            });
        }

        const statusCode = result.duplicate ? 200 : 201;

        return res.status(statusCode).json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("Edge ingest error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.retryEvent = async (req, res) => {
    try {
        const eventId = String(req.params && req.params.eventId ? req.params.eventId : "").trim();
        if (!eventId) {
            return res.status(422).json({
                success: false,
                message: "eventId is required",
            });
        }

        const existing = await edgeEventsRepo.getByEventId(eventId);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Edge event not found",
            });
        }

        const isFailed = String(existing.status || "").toUpperCase() === "FAILED";
        if (!isFailed) {
            return res.status(409).json({
                success: false,
                message: "Only failed events can be retried",
            });
        }

        if (existing.max_retries == null || existing.retry_count >= existing.max_retries) {
            return res.status(409).json({
                success: false,
                message: "Retry limit reached",
            });
        }

        await edgeEventsRepo.markForRetry({ eventId });

        const payload = {
            ...(existing.payload_json || {}),
        };
        const ingestResult = await edgeIngestService.ingestEvent(payload, { allowReplay: true });

        const normalizedStatus = String(ingestResult && ingestResult.status ? ingestResult.status : "").toUpperCase();
        const retryStatus = normalizedStatus === "SUCCESS" ? "SUCCESS" : "FAILED";
        const failureReason = retryStatus === "FAILED" ? ingestResult.action || "Retry failed" : null;

        await edgeEventsRepo.updateAfterRetry({
            eventId,
            status: retryStatus,
            sessionId: ingestResult && ingestResult.session_id ? ingestResult.session_id : null,
            failureReason,
        });

        return res.status(200).json({
            success: true,
            data: ingestResult,
        });
    } catch (error) {
        if (req.params && req.params.eventId) {
            try {
                await edgeEventsRepo.updateAfterRetry({
                    eventId: String(req.params.eventId).trim(),
                    status: "FAILED",
                    sessionId: null,
                    failureReason: error && error.message ? error.message : "Retry processing failed",
                });
            } catch (updateError) {
                console.error("Edge retry failure update error:", updateError);
            }
        }
        console.error("Edge retry error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.listEvents = async (req, res) => {
    try {
        const rows = await edgeEventsRepo.listEvents({
            status: req.query.status,
            lane: req.query.lane,
            trigger: req.query.trigger,
            from: req.query.from,
            to: req.query.to,
            q: req.query.q,
            page: req.query.page,
            pageSize: req.query.pageSize,
        });

        return res.status(200).json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error("List edge events error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.getEventDetail = async (req, res) => {
    try {
        const eventId = String(req.params && req.params.eventId ? req.params.eventId : "").trim();
        if (!eventId) {
            return res.status(422).json({
                success: false,
                message: "eventId is required",
            });
        }

        const row = await edgeEventsRepo.getByEventId(eventId);
        if (!row) {
            return res.status(404).json({
                success: false,
                message: "Edge event not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: row,
        });
    } catch (error) {
        console.error("Get edge event detail error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.getActiveSessions = async (req, res) => {
    try {
        const rows = await sessionsRepo.getActiveSessionsForOps({
            laneId: req.query.laneId,
            q: req.query.q,
            page: req.query.page,
            pageSize: req.query.pageSize,
        });

        return res.status(200).json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error("Get active sessions for ops error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
