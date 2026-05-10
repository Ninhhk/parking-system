const { pool } = require("../config/db");
const { EDGE_LPD_CORRELATION_WINDOW_SECONDS } = require("../config/constants");
const edgeEventsRepo = require("../repositories/edge.events.repo");
const sessionsRepo = require("../repositories/employee.sessions.repo");
const { sanitizePlate } = require("../utils/licensePlate");
const gatewayConfig = require("../config/edge_gateways.json");

const LPD_TRIGGER = "LPD";
const CAPACITY_FULL = "CAPACITY_FULL";

const normalizeTriggerType = (value) => String(value || "").trim().toUpperCase();
const normalizeTriggerValue = (value) => String(value || "").trim();

const toSafeFallbackPlate = (value) => {
    const normalized = sanitizePlate(String(value || "")).replace(/-/g, "");
    const suffix = normalized.slice(-10) || "UNKNOWN";
    return `EDGE${suffix}`.slice(0, 20);
};

const resolveOrCreateByIdentity = async (payload, triggerType, triggerValue, client) => {
    const lotId = payload.lot_id;
    const laneId = payload.lane_id;
    const vehicleType = String(payload.vehicle_type || "").toLowerCase();
    const rawPlate = payload.trigger && payload.trigger.plate ? payload.trigger.plate : payload.trigger.value;
    const sanitizedPlate = sanitizePlate(rawPlate);

    if (triggerType === "IC_CARD") {
        const existing = await sessionsRepo.findActiveByCardUid(triggerValue, client);
        if (existing) {
            return existing;
        }

        return sessionsRepo.startSession(
            {
                lot_id: lotId,
                license_plate: sanitizedPlate || toSafeFallbackPlate(triggerValue),
                vehicle_type: vehicleType,
                is_monthly: false,
                card_uid: triggerValue,
                entry_lane_id: laneId,
                metadata_in: {
                    source: "edge_ingest",
                    trigger_type: triggerType,
                },
            },
            client
        );
    }

    if (triggerType === "UHF_TAG") {
        const existing = await sessionsRepo.findActiveByEtagEpc(triggerValue, client);
        if (existing) {
            return existing;
        }

        return sessionsRepo.startSession(
            {
                lot_id: lotId,
                license_plate: sanitizedPlate || toSafeFallbackPlate(triggerValue),
                vehicle_type: vehicleType,
                is_monthly: false,
                etag_epc: triggerValue,
                entry_lane_id: laneId,
                metadata_in: {
                    source: "edge_ingest",
                    trigger_type: triggerType,
                },
            },
            client
        );
    }

    const existing = await sessionsRepo.findActiveByPlate(sanitizedPlate, client);
    if (existing) {
        return existing;
    }

    return sessionsRepo.startSession(
        {
            lot_id: lotId,
            license_plate: sanitizedPlate || toSafeFallbackPlate(triggerValue),
            vehicle_type: vehicleType,
            is_monthly: false,
            entry_lane_id: laneId,
            metadata_in: {
                source: "edge_ingest",
                trigger_type: triggerType,
            },
        },
        client
    );
};

const lookupLanePolicy = (laneId) => {
    for (const gw of gatewayConfig.gateways) {
        const lane = gw.lanes.find((l) => l.lane_id === laneId);
        if (lane) return lane;
    }
    return null;
};

const resolveLaneDirection = (payload) => {
    if (payload.lane_direction) {
        return String(payload.lane_direction).toUpperCase();
    }
    const lanePolicy = lookupLanePolicy(payload.lane_id);
    return (lanePolicy?.lane_direction ?? "ENTRY").toUpperCase();
};

const resolveExitByIdentity = async (payload, triggerType, triggerValue, client) => {
    let session;

    if (triggerType === "IC_CARD") {
        session = await sessionsRepo.findActiveByCardUid(triggerValue, client);
    } else if (triggerType === "UHF_TAG") {
        session = await sessionsRepo.findActiveByEtagEpc(triggerValue, client);
    } else {
        const rawPlate = payload.trigger && payload.trigger.plate ? payload.trigger.plate : triggerValue;
        const plate = sanitizePlate(rawPlate);
        session = await sessionsRepo.findActiveByPlate(plate, client);
    }

    if (!session) return null;
    return sessionsRepo.closeSession(session.session_id, client);
};

exports.ingestEvent = async (payload, options = {}) => {
    const client = await pool.connect();
    const allowReplay = Boolean(options && options.allowReplay);
    const triggerType = normalizeTriggerType(payload && payload.trigger ? payload.trigger.type : "");
    const triggerValue = normalizeTriggerValue(payload && payload.trigger ? payload.trigger.value : "");
    const normalizedPayload = {
        ...payload,
        trigger: {
            ...(payload && payload.trigger ? payload.trigger : {}),
            type: triggerType,
            value: triggerValue,
        },
    };

    try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [String(normalizedPayload.lane_id)]);

        let existing = await edgeEventsRepo.getByEventIdForUpdate(normalizedPayload.event_id, client);
        if (existing && !allowReplay) {
            await client.query("COMMIT");
            return {
                duplicate: true,
                status: existing.status,
                action: "DUPLICATE",
                event_id: existing.event_id,
                session_id: existing.session_id || null,
            };
        }

        if (!existing) {
            try {
                await edgeEventsRepo.createProcessing(
                    {
                        eventId: normalizedPayload.event_id,
                        gatewayId: normalizedPayload.gateway_id,
                        laneId: normalizedPayload.lane_id,
                        triggerType,
                        triggerValue: triggerValue || null,
                        occurredAt: normalizedPayload.occurred_at,
                        payload: normalizedPayload,
                    },
                    client
                );
            } catch (error) {
                if (error && error.code === "23505") {
                    existing = await edgeEventsRepo.getByEventIdForUpdate(normalizedPayload.event_id, client);
                    if (existing) {
                        await client.query("COMMIT");
                        return {
                            duplicate: true,
                            status: existing.status,
                            action: "DUPLICATE",
                            event_id: existing.event_id,
                            session_id: existing.session_id || null,
                        };
                    }
                }
                throw error;
            }
        }

        const direction = resolveLaneDirection(normalizedPayload);
        const resolvedTriggerValue = normalizedPayload.trigger.value || null;

        if (direction === "EXIT") {
            const closedSession = await resolveExitByIdentity(
                normalizedPayload,
                triggerType,
                resolvedTriggerValue,
                client
            );

            if (!closedSession) {
                if (allowReplay) {
                    await edgeEventsRepo.markFailed(
                        {
                            eventId: normalizedPayload.event_id,
                            errorCode: "EXIT_NO_ACTIVE_SESSION",
                            errorMessage: "No active session found to close for exit event",
                        },
                        client,
                        { incrementRetry: false }
                    );
                } else {
                    await edgeEventsRepo.markFailed(
                        {
                            eventId: normalizedPayload.event_id,
                            errorCode: "EXIT_NO_ACTIVE_SESSION",
                            errorMessage: "No active session found to close for exit event",
                        },
                        client
                    );
                }
                await client.query("COMMIT");
                return {
                    duplicate: false,
                    status: "FAILED",
                    action: "EXIT_NO_ACTIVE_SESSION",
                    event_id: normalizedPayload.event_id,
                    session_id: null,
                };
            }

            await edgeEventsRepo.markSuccess(
                {
                    eventId: normalizedPayload.event_id,
                    sessionId: closedSession.session_id,
                },
                client
            );
            await client.query("COMMIT");
            return {
                duplicate: false,
                status: "SUCCESS",
                action: "SESSION_CLOSED",
                event_id: normalizedPayload.event_id,
                session_id: closedSession.session_id,
            };
        }

        if (triggerType === LPD_TRIGGER) {
            const lpdPlate = sanitizePlate(normalizedPayload.trigger.value || normalizedPayload.trigger.plate || "");
            const enrichedSession = await sessionsRepo.enrichRecentSessionByLane(
                {
                    laneId: normalizedPayload.lane_id,
                    plate: lpdPlate || undefined,
                    imageInUrl: normalizedPayload.trigger.image_url || null,
                    metadataPatch: {
                        edge_event_id: normalizedPayload.event_id,
                        gateway_id: normalizedPayload.gateway_id,
                        occurred_at: normalizedPayload.occurred_at,
                    },
                    windowSeconds: EDGE_LPD_CORRELATION_WINDOW_SECONDS,
                },
                client
            );

            if (!enrichedSession) {
                if (allowReplay) {
                    await edgeEventsRepo.markFailed(
                        {
                            eventId: normalizedPayload.event_id,
                            errorCode: "LPD_UNMATCHED",
                            errorMessage: "No recent open session matched lane correlation window",
                        },
                        client,
                        { incrementRetry: false }
                    );
                } else {
                    await edgeEventsRepo.markFailed(
                        {
                            eventId: normalizedPayload.event_id,
                            errorCode: "LPD_UNMATCHED",
                            errorMessage: "No recent open session matched lane correlation window",
                        },
                        client
                    );
                }
                await client.query("COMMIT");
                return {
                    duplicate: false,
                    status: "FAILED",
                    action: "LPD_UNMATCHED",
                    event_id: normalizedPayload.event_id,
                    session_id: null,
                };
            }

            await edgeEventsRepo.markSuccess(
                {
                    eventId: normalizedPayload.event_id,
                    sessionId: enrichedSession.session_id,
                },
                client
            );

            await client.query("COMMIT");
            return {
                duplicate: false,
                status: "SUCCESS",
                action: "SESSION_RESOLVED",
                event_id: normalizedPayload.event_id,
                session_id: enrichedSession.session_id,
            };
        }

        const session = await resolveOrCreateByIdentity(
            normalizedPayload,
            triggerType,
            resolvedTriggerValue,
            client
        );

        if (!session) {
            if (allowReplay) {
                await edgeEventsRepo.markFailed(
                    {
                        eventId: normalizedPayload.event_id,
                        errorCode: CAPACITY_FULL,
                        errorMessage: "Cannot create parking session because lot capacity is full",
                    },
                    client,
                    { incrementRetry: false }
                );
            } else {
                await edgeEventsRepo.markFailed(
                    {
                        eventId: normalizedPayload.event_id,
                        errorCode: CAPACITY_FULL,
                        errorMessage: "Cannot create parking session because lot capacity is full",
                    },
                    client
                );
            }

            await client.query("COMMIT");
            return {
                duplicate: false,
                status: "FAILED",
                action: CAPACITY_FULL,
                event_id: normalizedPayload.event_id,
                session_id: null,
            };
        }

        await edgeEventsRepo.markSuccess(
            {
                eventId: normalizedPayload.event_id,
                sessionId: session.session_id,
            },
            client
        );

        await client.query("COMMIT");
        return {
            duplicate: false,
            status: "SUCCESS",
            action: "SESSION_RESOLVED",
            event_id: normalizedPayload.event_id,
            session_id: session.session_id,
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};
