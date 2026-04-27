const { pool } = require("../config/db");

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

exports.createProcessing = async (
    { eventId, gatewayId, laneId, triggerType, triggerValue, occurredAt, payload },
    client = pool
) => {
    const payloadJson = {
        ...(payload || {}),
        gatewayId: gatewayId || null,
        triggerType: triggerType || null,
        triggerValue: triggerValue || null,
    };

    const result = await client.query(
        `INSERT INTO edge_events(event_id, lane_id, occurred_at, status, payload_json)
         VALUES ($1, $2, $3, 'PROCESSING', $4::jsonb)
         RETURNING *`,
        [eventId, laneId, occurredAt || new Date(), JSON.stringify(payloadJson)]
    );

    return result.rows[0] || null;
};

exports.getByEventIdForUpdate = async (eventId, client = pool) => {
    const result = await client.query(
        `SELECT *
         FROM edge_events
         WHERE event_id = $1
         LIMIT 1
         FOR UPDATE`,
        [eventId]
    );
    return result.rows[0] || null;
};

exports.getByEventId = async (eventId, client = pool) => {
    const result = await client.query(
        `SELECT *
         FROM edge_events
         WHERE event_id = $1
         LIMIT 1`,
        [eventId]
    );
    return result.rows[0] || null;
};

exports.markSuccess = async ({ eventId, sessionId }, client = pool) => {
    const result = await client.query(
        `UPDATE edge_events
         SET status = 'SUCCESS',
             session_id = $2,
             updated_at = NOW()
         WHERE event_id = $1
         RETURNING *`,
        [eventId, sessionId || null]
    );
    return result.rows[0] || null;
};

exports.markFailed = async ({ eventId, errorCode, errorMessage }, client = pool, config = {}) => {
    const { incrementRetry = true } = config || {};
    const reasonParts = [];
    if (errorCode) reasonParts.push(`[${errorCode}]`);
    if (errorMessage) reasonParts.push(errorMessage);
    const failureReason = reasonParts.join(" ") || null;

    const result = await client.query(
        `UPDATE edge_events
         SET status = 'FAILED',
             failure_reason = $2,
             ${incrementRetry ? "retry_count = retry_count + 1,\n             last_retry_at = NOW()," : ""}
             updated_at = NOW()
         WHERE event_id = $1
         RETURNING *`,
        [eventId, failureReason]
    );
    return result.rows[0] || null;
};

exports.markForRetry = async ({ eventId }, client = pool) => {
    const result = await client.query(
        `UPDATE edge_events
         SET status = 'PROCESSING',
             retry_count = retry_count + 1,
             last_retry_at = NOW(),
             updated_at = NOW()
         WHERE event_id = $1
         RETURNING *`,
        [eventId]
    );
    return result.rows[0] || null;
};

exports.updateAfterRetry = async ({ eventId, status, sessionId, failureReason }, client = pool) => {
    const result = await client.query(
        `UPDATE edge_events
         SET status = $2,
             session_id = $3,
             failure_reason = $4,
             updated_at = NOW()
         WHERE event_id = $1
         RETURNING *`,
        [eventId, status, sessionId || null, failureReason || null]
    );
    return result.rows[0] || null;
};

exports.listEvents = async ({ status, lane, laneId, trigger, triggerType, from, to, q, page, pageSize } = {}, client = pool) => {
    const conditions = [];
    const params = [];

    if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
    }

    const normalizedLane = lane || laneId;
    if (normalizedLane) {
        params.push(normalizedLane);
        conditions.push(`lane_id = $${params.length}`);
    }

    const normalizedTrigger = trigger || triggerType;
    if (normalizedTrigger) {
        params.push(String(normalizedTrigger).trim().toUpperCase());
        conditions.push(`payload_json ->> 'triggerType' = $${params.length}`);
    }

    if (from) {
        params.push(from);
        conditions.push(`occurred_at >= $${params.length}`);
    }

    if (to) {
        params.push(to);
        conditions.push(`occurred_at <= $${params.length}`);
    }

    if (q && String(q).trim().length > 0) {
        const normalizedQuery = `%${String(q).trim()}%`;
        params.push(normalizedQuery);
        const qIndex = params.length;
        conditions.push(`(
            event_id ILIKE $${qIndex}
            OR payload_json -> 'trigger' ->> 'value' ILIKE $${qIndex}
            OR payload_json -> 'trigger' ->> 'plate' ILIKE $${qIndex}
            OR payload_json ->> 'triggerValue' ILIKE $${qIndex}
        )`);
    }

    const parsedPage = Number(page);
    const parsedPageSize = Number(pageSize);

    const normalizedPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : DEFAULT_PAGE;
    const normalizedPageSize =
        Number.isInteger(parsedPageSize) && parsedPageSize > 0
            ? Math.min(parsedPageSize, MAX_PAGE_SIZE)
            : DEFAULT_PAGE_SIZE;

    params.push(normalizedPageSize);
    const limitIndex = params.length;
    params.push((normalizedPage - 1) * normalizedPageSize);
    const offsetIndex = params.length;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await client.query(
        `SELECT *
         FROM edge_events
         ${whereClause}
         ORDER BY occurred_at DESC, edge_event_id DESC
         LIMIT $${limitIndex}
         OFFSET $${offsetIndex}`,
        params
    );

    return result.rows;
};
